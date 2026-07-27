<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessPaymentJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public int $backoff = 10;

    public int $timeout = 60;

    public function __construct(private string $reference) {}

    public function handle(): void
    {
        app(\App\Services\PaymentService::class)->confirm($this->reference);
    }

    public function failed(\Throwable $exception): void
    {
        logger()->error('ProcessPaymentJob failed', [
            'reference' => $this->reference,
            'error' => $exception->getMessage(),
        ]);
    }
}
