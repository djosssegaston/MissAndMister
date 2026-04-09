<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessPaymentJob implements ShouldQueue
{
    use Queueable;

    public function __construct(private string $reference)
    {
    }

    /**
     * Create a new job instance.
     */
    public function handle(): void
    {
        app(\App\Services\PaymentService::class)->confirm($this->reference);
    }
}
