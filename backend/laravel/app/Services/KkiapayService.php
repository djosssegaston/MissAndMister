<?php

namespace App\Services;

use Illuminate\Support\Str;

class KkiapayService
{
    public function initiatePayment(float $amount, string $currency = 'XOF', array $metadata = []): array
    {
        // In production, call Kkiapay API here. For now we mock the reference.
        $reference = Str::upper(Str::random(12));

        return [
            'reference' => $reference,
            'amount' => $amount,
            'currency' => $currency,
            'payment_url' => config('app.url') . '/payments/' . $reference,
            'meta' => $metadata,
        ];
    }

    public function verifyTransaction(string $reference, ?string $transactionId = null): bool
    {
        // Placeholder: external verification should happen here.
        return true;
    }

    public function verifySignature(string $payload, ?string $signature): bool
    {
        $secret = config('services.kkiapay.webhook_secret');
        if (!$secret || !$signature) {
            return false;
        }

        $computed = hash_hmac('sha256', $payload, $secret);

        return hash_equals($computed, $signature);
    }
}
