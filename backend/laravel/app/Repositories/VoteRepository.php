<?php

namespace App\Repositories;

use App\Models\Payment;
use App\Models\Vote;
use Illuminate\Database\Eloquent\Builder;

class VoteRepository
{
    public function create(array $data): Vote
    {
        return Vote::create($data);
    }

    public function paginateFiltered(array $filters, int $perPage = 20)
    {
        $query = $this->filteredListQuery($filters)
            ->orderByDesc('created_at');

        return $query->paginate($perPage);
    }

    public function summarizeFiltered(array $filters = []): array
    {
        $row = $this->filteredSummaryQuery($filters)
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN votes.status = ? AND (votes.payment_id IS NULL OR payments.status = ?) THEN votes.quantity ELSE 0 END), 0) as counted_votes',
                [Vote::STATUS_CONFIRMED, Payment::STATUS_SUCCEEDED]
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN votes.status = ? AND (votes.payment_id IS NULL OR payments.status = ?) THEN votes.amount ELSE 0 END), 0) as revenue',
                [Vote::STATUS_CONFIRMED, Payment::STATUS_SUCCEEDED]
            )
            ->selectRaw('COALESCE(SUM(CASE WHEN votes.status = ? THEN votes.quantity ELSE 0 END), 0) as suspect_votes', ['suspect'])
            ->selectRaw('COALESCE(SUM(CASE WHEN votes.status = ? THEN votes.quantity ELSE 0 END), 0) as cancelled_votes', ['cancelled'])
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN votes.status = ? AND (votes.payment_id IS NULL OR payments.status = ?) THEN 1 ELSE 0 END), 0) as successful_payments',
                [Vote::STATUS_CONFIRMED, Payment::STATUS_SUCCEEDED]
            )
            ->first();

        return [
            'counted_votes' => (int) ($row->counted_votes ?? 0),
            'valid_votes' => (int) ($row->counted_votes ?? 0),
            'suspect_votes' => (int) ($row->suspect_votes ?? 0),
            'cancelled_votes' => (int) ($row->cancelled_votes ?? 0),
            'revenue' => (float) ($row->revenue ?? 0),
            'payments' => (int) ($row->successful_payments ?? 0),
        ];
    }

    public function recentConfirmed(int $limit = 10)
    {
        return Vote::with(['user:id,name,email', 'candidate:id,first_name,last_name,category_id', 'candidate.category:id,name'])
            ->successful()
            ->latest()
            ->limit($limit)
            ->get();
    }

    public function countUserVotesToday(?int $userId): int
    {
        if (!$userId) {
            return 0;
        }
        return (int) Vote::where('user_id', $userId)
            ->whereDate('created_at', now()->toDateString())
            ->sum('quantity');
    }

    public function countIpVotesToday(string $ip): int
    {
        return (int) Vote::where('ip_address', $ip)
            ->whereDate('created_at', now()->toDateString())
            ->sum('quantity');
    }

    private function filteredListQuery(array $filters): Builder
    {
        return Vote::with([
            'user:id,name,email,phone',
            'candidate:id,first_name,last_name,category_id,public_number,public_uid,slug',
            'candidate.category:id,name',
            'payment:id,user_id,reference,status,amount,currency,provider,meta,payload',
        ])
            ->when(isset($filters['id']) && $filters['id'], fn ($q) => $q->whereKey($filters['id']))
            ->when(isset($filters['status']) && $filters['status'], fn ($q) => $q->where('status', $filters['status']))
            ->when(isset($filters['candidate_id']) && $filters['candidate_id'], fn ($q) => $q->where('candidate_id', $filters['candidate_id']))
            ->when(isset($filters['from']) && $filters['from'], fn ($q) => $q->whereDate('created_at', '>=', $filters['from']))
            ->when(isset($filters['to']) && $filters['to'], fn ($q) => $q->whereDate('created_at', '<=', $filters['to']));
    }

    private function filteredSummaryQuery(array $filters): Builder
    {
        return Vote::query()
            ->leftJoin('payments', 'payments.id', '=', 'votes.payment_id')
            ->when(isset($filters['id']) && $filters['id'], fn ($q) => $q->where('votes.id', $filters['id']))
            ->when(isset($filters['status']) && $filters['status'], fn ($q) => $q->where('votes.status', $filters['status']))
            ->when(isset($filters['candidate_id']) && $filters['candidate_id'], fn ($q) => $q->where('votes.candidate_id', $filters['candidate_id']))
            ->when(isset($filters['from']) && $filters['from'], fn ($q) => $q->whereDate('votes.created_at', '>=', $filters['from']))
            ->when(isset($filters['to']) && $filters['to'], fn ($q) => $q->whereDate('votes.created_at', '<=', $filters['to']));
    }
}
