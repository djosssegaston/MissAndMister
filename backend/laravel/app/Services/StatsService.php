<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\Vote;
use App\Models\User;
use App\Repositories\VoteRepository;

class StatsService
{
    public function __construct(private VoteRepository $votes)
    {
    }

    public function summary(): array
    {
        $summary = $this->votes->summarizeFiltered();

        $top = Vote::selectRaw('candidate_id, SUM(quantity) as votes')
            ->successful()
            ->groupBy('candidate_id')
            ->orderByDesc('votes')
            ->take(5)
            ->get();

        $top->load(['candidate.category']);

        return [
            'candidates' => (int) Candidate::count(),
            'votes' => (int) ($summary['counted_votes'] ?? 0),
            'payments' => (int) ($summary['payments'] ?? 0),
            'users' => (int) User::count(),
            'revenue' => (float) ($summary['revenue'] ?? 0),
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
