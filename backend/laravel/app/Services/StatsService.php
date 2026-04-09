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
            ->where('status', 'confirmed')
            ->groupBy('candidate_id')
            ->orderByDesc('votes')
            ->take(5)
            ->get();

        $top->load(['candidate.category']);

        return [
            'candidates' => Candidate::count(),
            'votes' => Vote::where('status', 'confirmed')->sum('quantity'),
            'payments' => Payment::count(),
            'users' => User::count(),
            'revenue' => Payment::where('status', 'succeeded')->sum('amount'),
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
        $universities = Candidate::distinct('university')->count('university');

        return [
            'totalCandidates' => Candidate::where('is_active', true)->count(),
            'totalVotes' => Vote::where('status', 'confirmed')->sum('quantity'),
            'totalUsers' => User::count(),
            'totalUniversities' => $universities,
        ];
    }
}
