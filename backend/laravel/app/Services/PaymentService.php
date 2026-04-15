<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\ActivityLog;
use App\Models\User;
use App\Repositories\PaymentRepository;
use App\Repositories\TransactionRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentService
{
    public function __construct(
        private PaymentRepository $payments,
        private TransactionRepository $transactions,
        private FedaPayService $fedapay,
    ) {
    }

    public function initiate(?int $userId, float $amount, string $currency = "XOF", array $metadata = []): Payment
    {
        $currency = strtoupper($currency);
        $reference = Str::upper(Str::random(12));
        $candidateName = trim((string) Arr::get($metadata, 'candidate_name', ''));
        $voter = $userId ? User::query()->select(['id', 'name', 'email', 'phone'])->find($userId) : null;
        $description = $candidateName !== ''
            ? 'Vote pour ' . $candidateName
            : 'Paiement sécurisé Miss & Mister';
        $callbackUrl = route('payments.callback', ['reference' => $reference]);
        $customer = $this->buildCustomerPayload($voter);
        $enrichedMetadata = array_merge($metadata, array_filter([
            'voter_name' => $voter?->name,
            'voter_email' => $voter?->email,
            'voter_phone' => $voter?->phone,
        ], static fn ($value) => filled($value)));

        $transaction = $this->fedapay->createTransaction(
            $amount,
            $currency,
            $description,
            $callbackUrl,
            $reference,
            array_merge($enrichedMetadata, [
                'payment_reference' => $reference,
                'amount' => $amount,
                'currency' => strtoupper($currency),
                'provider' => 'fedapay',
            ]),
            $customer,
        );

        $transactionId = (string) Arr::get($transaction, 'id', '');
        $transactionStatus = strtolower((string) Arr::get($transaction, 'status', 'pending'));
        if ($transactionId === '') {
            logger()->warning('FedaPay transaction created without local transaction id', [
                'reference' => $reference,
                'response_keys' => array_keys($transaction),
                'response_status' => $transactionStatus,
            ]);

            throw new \RuntimeException('Impossible d’obtenir la transaction FedaPay. Réessayez dans quelques instants.');
        }

        $tokenPayload = $this->fedapay->generateTransactionToken($transactionId);
        $hostedPaymentUrl = trim((string) Arr::get($tokenPayload, 'url', ''));

        if ($hostedPaymentUrl === '') {
            logger()->warning('FedaPay token generated without hosted payment url', [
                'reference' => $reference,
                'transaction_id' => $transactionId,
                'token_keys' => array_keys($tokenPayload),
            ]);

            throw new \RuntimeException('Impossible d’ouvrir la page de paiement FedaPay pour le moment.');
        }
        // The initial API call only reserves the remote transaction. The local payment
        // becomes successful only after server-side sync/webhook confirmation.
        $status = 'initiated';

        $payment = $this->payments->create([
            'user_id' => $userId,
            'reference' => $reference,
            'transaction_id' => $transactionId !== '' ? $transactionId : null,
            'amount' => $amount,
            'currency' => $currency,
            'provider' => 'fedapay',
            'status' => $status,
            'payload' => [
                'fedapay' => $transaction,
                'fedapay_token' => $tokenPayload,
            ],
            'meta' => array_merge($metadata, [
                'payment_url' => $hostedPaymentUrl,
                'payment_page_url' => route('payments.show', ['reference' => $reference]),
                'provider' => 'fedapay',
                'fedapay_transaction_id' => $transactionId ?: null,
                'fedapay_status' => $transactionStatus,
                'fedapay_environment' => $this->fedapay->environment(),
                'fedapay_token' => Arr::get($tokenPayload, 'token'),
            ], $enrichedMetadata),
            'paid_at' => null,
        ]);

        ActivityLog::create([
            'causer_id' => $userId,
            'causer_type' => \App\Models\User::class,
            'action' => 'payment_initiated',
            'ip_address' => $metadata['ip'] ?? null,
            'meta' => [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
                'transaction_id' => $payment->transaction_id,
                'provider' => 'fedapay',
            ],
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

        if ($payment->status === 'succeeded') {
            return $payment;
        }

        return DB::transaction(function () use ($payment, $payload) {
            $transactionReference = $this->extractTransactionReference($payload) ?? $payment->transaction_id;

            if ($transactionReference && !$payment->transaction_id) {
                $payment->update(['transaction_id' => $transactionReference]);
            }

            $this->payments->updateStatus($payment, 'succeeded', $payload);

            if (!$transactionReference || !$payment->transactions()->where('provider_reference', $transactionReference)->exists()) {
                $this->transactions->create([
                    'payment_id' => $payment->id,
                    'type' => 'credit',
                    'status' => 'succeeded',
                    'amount' => $payment->amount,
                    'currency' => $payment->currency,
                    'provider_reference' => $transactionReference,
                    'payload' => $payload,
                ]);
            }

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

    private function extractTransactionReference(array $payload): ?string
    {
        $candidates = [
            data_get($payload, 'transaction_id'),
            data_get($payload, 'transactionId'),
            data_get($payload, 'transaction.id'),
            data_get($payload, 'data.id'),
            data_get($payload, 'data.entity.id'),
            data_get($payload, 'entity.id'),
            data_get($payload, 'data.transaction_id'),
            data_get($payload, 'merchant_reference'),
            data_get($payload, 'data.merchant_reference'),
            data_get($payload, 'data.entity.merchant_reference'),
            data_get($payload, 'custom_metadata.payment_reference'),
            data_get($payload, 'data.custom_metadata.payment_reference'),
        ];

        foreach ($candidates as $candidate) {
            if ($candidate === null) {
                continue;
            }

            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function buildCustomerPayload(?User $voter): ?array
    {
        if (!$voter) {
            return null;
        }

        $name = trim((string) ($voter->name ?? ''));
        $parts = preg_split('/\s+/', $name) ?: [];
        $firstname = trim((string) ($parts[0] ?? ''));
        $lastname = trim((string) implode(' ', array_slice($parts, 1)));

        $customer = array_filter([
            'email' => $voter->email,
            'firstname' => $firstname !== '' ? $firstname : null,
            'lastname' => $lastname !== '' ? $lastname : null,
            'phone_number' => $voter->phone,
        ], static fn ($value) => filled($value));

        return $customer !== [] ? $customer : null;
    }
}
