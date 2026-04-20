<?php

namespace App\Services;

use App\Models\Payment;
use App\Repositories\PaymentRepository;

class FedapayWebhookService
{
    public function __construct(
        private PaymentService $payments,
        private PaymentRepository $paymentRepo,
        private FedaPayService $fedapay,
    ) {
    }

    public function processWebhookPayload(
        array $payload,
        string $eventName,
        ?string $transactionId,
        ?string $reference,
    ): array {
        $payment = null;
        $remoteTransaction = null;
        $payloadStatus = $this->extractWebhookStatus($payload);

        if ($transactionId !== null) {
            $payment = $this->paymentRepo->findByTransactionId($transactionId);
        }

        if (!$payment && $reference !== null) {
            $payment = $this->paymentRepo->findByReference($reference);
        }

        $shouldFetchRemoteTransaction = $transactionId !== null && (!$payment || $payloadStatus === '');
        if ($shouldFetchRemoteTransaction) {
            try {
                $remoteTransaction = $this->fedapay->retrieveTransaction($transactionId);
            } catch (\Throwable $exception) {
                logger()->warning('FedaPay transaction lookup failed during webhook sync', [
                    'payment_id' => $payment?->id,
                    'transaction_id' => $transactionId,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        if (!$payment && $remoteTransaction) {
            $syncedPayment = $this->payments->syncRemoteSuccessfulTransaction($remoteTransaction);
            if ($syncedPayment) {
                return [
                    'result' => 'synced_without_local_match',
                    'outcome' => $syncedPayment->status,
                    'payment_id' => $syncedPayment->id,
                ];
            }
        }

        if (!$payment) {
            logger()->warning('FedaPay webhook received but no local payment matched', [
                'event' => $eventName,
                'transaction_id' => $transactionId,
                'reference' => $reference,
                'status' => $payloadStatus !== '' ? $payloadStatus : null,
            ]);

            return [
                'result' => 'unmatched',
                'outcome' => 'processing',
            ];
        }

        $outcome = $this->resolveWebhookOutcome($payload, $remoteTransaction, $eventName);
        $updatedPayment = $this->applyOutcome($payment, $outcome, $remoteTransaction ?: $payload, $eventName);

        return [
            'result' => 'applied',
            'outcome' => $updatedPayment->status,
            'payment_id' => $updatedPayment->id,
        ];
    }

    private function applyOutcome(Payment $payment, string $outcome, array $payload = [], ?string $eventName = null): Payment
    {
        if ($outcome === 'succeeded') {
            $payment = $this->payments->confirm($payment->reference, $payload);

            return $payment->fresh(['vote']);
        }

        if ($outcome === 'failed') {
            return $this->payments
                ->markPaymentAsFailed($payment, $payload, $eventName ?: 'transaction.failed')
                ->fresh(['vote']);
        }

        if ($outcome === 'processing') {
            $payment = $this->paymentRepo->updateStatus($payment, 'processing', $payload);
        }

        return $payment->fresh(['vote']);
    }

    private function resolveWebhookOutcome(array $payload, ?array $remoteTransaction, string $eventName): string
    {
        $status = strtolower((string) (
            data_get($remoteTransaction, 'status')
            ?: $this->extractWebhookStatus($payload)
            ?: ''
        ));

        $approvedIndicators = ['approved', 'succeeded', 'successful', 'success', 'paid', 'transferred'];
        $failureIndicators = ['canceled', 'cancelled', 'declined', 'failed', 'expired', 'rejected', 'refunded'];
        $processingIndicators = ['pending', 'processing', 'created', 'initiated'];

        if (
            in_array($status, $approvedIndicators, true)
            || str_contains($eventName, 'approved')
            || str_contains($eventName, 'success')
            || str_contains($eventName, 'paid')
            || str_contains($eventName, 'transferred')
        ) {
            return 'succeeded';
        }

        if (
            in_array($status, $failureIndicators, true)
            || str_contains($eventName, 'canceled')
            || str_contains($eventName, 'cancelled')
            || str_contains($eventName, 'declined')
            || str_contains($eventName, 'failed')
            || str_contains($eventName, 'refunded')
            || str_contains($eventName, 'expired')
        ) {
            return 'failed';
        }

        if (
            in_array($status, $processingIndicators, true)
            || str_contains($eventName, 'pending')
            || str_contains($eventName, 'created')
            || str_contains($eventName, 'updated')
        ) {
            return 'processing';
        }

        return 'processing';
    }

    private function extractWebhookStatus(array $payload): string
    {
        $candidates = [
            data_get($payload, 'status'),
            data_get($payload, 'data.status'),
            data_get($payload, 'data.entity.status'),
            data_get($payload, 'data.object.status'),
            data_get($payload, 'data.transaction.status'),
            data_get($payload, 'transaction.status'),
        ];

        foreach ($candidates as $candidate) {
            $value = strtolower(trim((string) $candidate));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }
}

