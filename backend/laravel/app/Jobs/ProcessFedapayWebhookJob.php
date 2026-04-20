<?php

namespace App\Jobs;

use App\Services\FedapayWebhookService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class ProcessFedapayWebhookJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;
    public array $backoff = [10, 30, 90];

    public function __construct(
        private array $payload,
        private string $eventName,
        private ?string $transactionId,
        private ?string $reference,
        private ?string $status,
        private string $fingerprint,
        private string $lockKey,
    ) {
    }

    public function handle(FedapayWebhookService $webhookProcessor): void
    {
        $result = $webhookProcessor->processWebhookPayload(
            $this->payload,
            $this->eventName,
            $this->transactionId,
            $this->reference,
        );

        logger()->info('FedaPay webhook processed asynchronously', [
            'event' => $this->eventName,
            'transaction_id' => $this->transactionId,
            'reference' => $this->reference,
            'status' => $this->status !== null && $this->status !== '' ? $this->status : null,
            'fingerprint' => $this->fingerprint,
            'result' => $result['result'] ?? null,
            'outcome' => $result['outcome'] ?? null,
            'payment_id' => $result['payment_id'] ?? null,
        ]);
    }

    public function failed(?\Throwable $exception): void
    {
        Cache::forget($this->lockKey);

        logger()->warning('FedaPay webhook async processing exhausted retries', [
            'event' => $this->eventName,
            'transaction_id' => $this->transactionId,
            'reference' => $this->reference,
            'status' => $this->status !== null && $this->status !== '' ? $this->status : null,
            'fingerprint' => $this->fingerprint,
            'error' => $exception?->getMessage(),
        ]);
    }
}
