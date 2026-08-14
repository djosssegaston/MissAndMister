<?php

namespace App\Jobs;

use Illuminate\Foundation\Queue\Queueable;

class CalculateResultsJob
{
    use Queueable;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        app(\App\Services\ResultService::class)->calculateAndPersist();
    }
}
