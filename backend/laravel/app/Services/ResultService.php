<?php

namespace App\Services;

use App\Models\Result;
use Illuminate\Support\Facades\DB;

class ResultService
{
    public function calculateAndPersist(): void
    {
        $aggregates = DB::table('votes')
            ->leftJoin('payments', 'payments.id', '=', 'votes.payment_id')
            ->join('candidates', 'candidates.id', '=', 'votes.candidate_id')
            ->selectRaw('votes.candidate_id, candidates.category_id, SUM(votes.quantity) as total_votes, SUM(votes.amount) as total_amount')
            ->where('votes.status', 'confirmed')
            ->where(function ($query) {
                $query
                    ->whereNull('votes.payment_id')
                    ->orWhere('payments.status', 'succeeded');
            })
            ->groupBy('votes.candidate_id', 'candidates.category_id')
            ->get();

        foreach ($aggregates as $row) {
            Result::updateOrCreate(
                ['candidate_id' => $row->candidate_id],
                [
                    'category_id' => $row->category_id,
                    'total_votes' => $row->total_votes,
                    'total_amount' => $row->total_amount,
                    'status' => 'published',
                ]
            );
        }
    }
}
