<?php

namespace App\Repositories;

use App\Models\Vote;

class VoteRepository
{
    public function create(array $data): Vote
    {
        return Vote::create($data);
    }

    public function paginateFiltered(array $filters, int $perPage = 20)
    {
        $query = Vote::with(['user:id,name,email', 'candidate:id,first_name,last_name,category_id', 'candidate.category:id,name', 'payment:id,reference,status,amount,currency'])
            ->when(isset($filters['id']) && $filters['id'], fn($q) => $q->whereKey($filters['id']))
            ->when(isset($filters['status']) && $filters['status'], fn($q) => $q->where('status', $filters['status']))
            ->when(isset($filters['candidate_id']) && $filters['candidate_id'], fn($q) => $q->where('candidate_id', $filters['candidate_id']))
            ->when(isset($filters['from']) && $filters['from'], fn($q) => $q->whereDate('created_at', '>=', $filters['from']))
            ->when(isset($filters['to']) && $filters['to'], fn($q) => $q->whereDate('created_at', '<=', $filters['to']))
            ->orderByDesc('created_at');

        return $query->paginate($perPage);
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
}
