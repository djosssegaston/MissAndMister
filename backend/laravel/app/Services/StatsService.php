<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\Payment;
use App\Models\Vote;
use App\Models\User;

class StatsService
{
    public function summary(): array
    {
        $top = Vote::selectRaw('candidate_id, SUM(quantity) as votes')
            ->successful()
            ->groupBy('candidate_id')
            ->orderByDesc('votes')
            ->take(5)
            ->get();

        $top->load(['candidate.category']);

        return [
            'candidates' => Candidate::count(),
            'votes' => Vote::successful()->sum('quantity'),
            'payments' => Payment::count(),
            'users' => User::count(),
            'revenue' => Payment::succeeded()->sum('amount'),
            'top_candidates' => $top->map(function ($row) {
                return [
                    'candidate_id' => $row->candidate_id,
                    'votes' => $row->votes,
                    'candidate' => $row->candidate ? [
                        'id' => $row->candidate->id,
                        'first_name' => $row->candidate->first_name,
                        'last_name' => $row->candidate->last_name,
                        'university' => $row->candidate->university,
                        'category' => $row->candidate->category?->name,
                    ] : null,
                ];
            }),
        ];
    }

    public function publicSummary(): array
    {
        $publicCandidates = Candidate::query()
            ->where(function ($query) {
                $query->where('status', 'active')->orWhereNull('status');
            })
            ->where(function ($query) {
                $query->where('is_active', true)->orWhereNull('is_active');
            });

        return [
            'totalCandidates' => (clone $publicCandidates)->count(),
            'totalVotes' => Vote::successful()->sum('quantity'),
            'totalUsers' => User::count(),
            'totalUniversities' => (clone $publicCandidates)->distinct('university')->count('university'),
        ];
    }
}
