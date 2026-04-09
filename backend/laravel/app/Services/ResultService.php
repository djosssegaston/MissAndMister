<?php

namespace App\Services;

use App\Models\Result;
use Illuminate\Support\Facades\DB;

class ResultService
{
    public function calculateAndPersist(): void
    {
        $aggregates = DB::table('votes')
            ->selectRaw('candidate_id, SUM(quantity) as total_votes, SUM(amount) as total_amount')
            ->where('status', 'confirmed')
            ->groupBy('candidate_id')
            ->get();

        foreach ($aggregates as $row) {
            Result::updateOrCreate(
                ['candidate_id' => $row->candidate_id],
                [
                    'total_votes' => $row->total_votes,
                    'total_amount' => $row->total_amount,
                    'status' => 'published',
                ]
            );
        }
    }
}
