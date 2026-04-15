<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DetectFraudJob implements ShouldQueue
{
    use Queueable;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $service = app(\App\Services\FraudDetectionService::class);
        $votes = \App\Models\Vote::successful()
            ->whereDate('created_at', now()->toDateString())
            ->get();

        foreach ($votes as $vote) {
            $service->report($vote->user_id, $vote->id, $vote->ip_address, 10, 'Daily scan');
        }
    }
}
