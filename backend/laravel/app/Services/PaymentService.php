<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\ActivityLog;
use App\Repositories\PaymentRepository;
use App\Repositories\TransactionRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(
        private PaymentRepository $payments,
        private TransactionRepository $transactions,
        private KkiapayService $kkiapay,
    ) {
    }

    public function initiate(?int $userId, float $amount, string $currency = "XOF", array $metadata = []): Payment
    {
        $init = $this->kkiapay->initiatePayment($amount, $currency, $metadata);

        $payment = $this->payments->create([
            'user_id' => $userId,
            'reference' => $init['reference'],
            'amount' => $amount,
            'currency' => $currency,
            'provider' => 'kkiapay',
            'status' => 'initiated',
            'meta' => Arr::only($init, ['payment_url', 'meta']),
        ]);

        ActivityLog::create([
            'causer_id' => $userId,
            'causer_type' => \App\Models\User::class,
            'action' => 'payment_initiated',
            'ip_address' => $metadata['ip'] ?? null,
            'meta' => ['payment_id' => $payment->id, 'reference' => $payment->reference],
            'status' => 'active',
        ]);

        return $payment;
    }

    public function confirm(string $reference, array $payload = []): ?Payment
    {
        $payment = $this->payments->findByReference($reference);
        if (!$payment) {
            return null;
        }

        return DB::transaction(function () use ($payment, $payload) {
            $this->payments->updateStatus($payment, 'succeeded', $payload);
            $this->transactions->create([
                'payment_id' => $payment->id,
                'type' => 'credit',
                'status' => 'succeeded',
                'amount' => $payment->amount,
                'currency' => $payment->currency,
                'provider_reference' => $payload['transaction_id'] ?? null,
                'payload' => $payload,
            ]);

            ActivityLog::create([
                'causer_id' => $payment->user_id,
                'causer_type' => \App\Models\User::class,
                'action' => 'payment_confirmed',
                'ip_address' => $payload['ip_address'] ?? null,
                'meta' => ['payment_id' => $payment->id, 'reference' => $payment->reference],
                'status' => 'active',
            ]);

            return $payment;
        });
    }
}
