<?php

namespace App\Repositories;

use App\Models\Payment;

class PaymentRepository
{
    public function create(array $data): Payment
    {
        return Payment::create($data);
    }

    public function findByReference(string $reference): ?Payment
    {
        return Payment::where('reference', $reference)->first();
    }

    public function findByTransactionId(string $transactionId): ?Payment
    {
        return Payment::where('transaction_id', $transactionId)->first();
    }

    public function updateStatus(Payment $payment, string $status, array $payload = []): Payment
    {
        $payment->update([
            'status' => $status,
            'payload' => array_merge($payment->payload ?? [], $payload),
            'paid_at' => $status === 'succeeded' ? now() : $payment->paid_at,
        ]);

        return $payment;
    }
}
