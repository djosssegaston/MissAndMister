<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Candidate;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vote;
use App\Jobs\SendVoteConfirmationJob;
use App\Repositories\PaymentRepository;
use App\Repositories\TransactionRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentService
{
    private const DEFAULT_WARM_RECONCILE_LIMIT = 10;
    private const DEFAULT_RECONCILE_LIMIT = 50;
    private const DEFAULT_RECONCILE_RECENT_HOURS = 2160;
    private const RECONCILE_STATUSES = ['initiated', 'processing', 'pending'];
    private const FAILURE_STATUSES = ['canceled', 'cancelled', 'declined', 'failed', 'expired', 'rejected', 'refunded'];
    private const SUCCESS_STATUSES = ['approved', 'succeeded', 'successful', 'success', 'paid', 'transferred'];
    private const PROCESSING_STATUSES = ['pending', 'processing', 'created', 'initiated'];

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
            return $this->reconcileSuccessfulPayment($payment, $payload);
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

            $payment = $this->reconcileSuccessfulPayment($payment->fresh(), $payload);

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

    public function reconcileSuccessfulAssociations(int $limit = 250): void
    {
        Payment::query()
            ->with(['vote', 'user'])
            ->where('status', Payment::STATUS_SUCCEEDED)
            ->where(function ($query) {
                $query
                    ->whereNull('user_id')
                    ->orDoesntHave('vote')
                    ->orWhereHas('vote', function ($voteQuery) {
                        $voteQuery
                            ->whereNull('user_id')
                            ->orWhereNull('ip_address')
                            ->orWhere('status', '!=', Vote::STATUS_CONFIRMED);
                    });
            })
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->each(function (Payment $payment): void {
                try {
                    $this->reconcileSuccessfulPayment($payment);
                } catch (\Throwable $exception) {
                    logger()->warning('Failed to reconcile successful payment associations', [
                        'payment_id' => $payment->id,
                        'reference' => $payment->reference,
                        'error' => $exception->getMessage(),
                    ]);
                }
            });
    }

    public function warmPaymentStateForReadModels(
        int $limit = self::DEFAULT_WARM_RECONCILE_LIMIT,
        int $cooldownSeconds = 45,
        int $recentHours = self::DEFAULT_RECONCILE_RECENT_HOURS,
    ): void
    {
        $this->reconcileUnsettledFedapayPaymentsIfDue($limit, $cooldownSeconds, $recentHours);
        $this->reconcileSuccessfulAssociations(max($limit * 4, 250));
    }

    public function scheduleWarmPaymentStateForReadModels(
        int $limit = 10,
        int $cooldownSeconds = 10,
        int $recentHours = self::DEFAULT_RECONCILE_RECENT_HOURS,
    ): void
    {
        static $scheduled = false;

        if ($scheduled) {
            return;
        }

        $scheduled = true;

        app()->terminating(function () use ($limit, $cooldownSeconds, $recentHours): void {
            try {
                $this->reconcileUnsettledFedapayPaymentsIfDue($limit, $cooldownSeconds, $recentHours);
                $this->reconcileSuccessfulAssociations(max($limit * 2, 50));
            } catch (\Throwable $exception) {
                logger()->warning('Deferred payment read-model warm failed', [
                    'error' => $exception->getMessage(),
                ]);
            }
        });
    }

    public function reconcileUnsettledFedapayPaymentsIfDue(
        int $limit = self::DEFAULT_WARM_RECONCILE_LIMIT,
        int $cooldownSeconds = 45,
        int $recentHours = self::DEFAULT_RECONCILE_RECENT_HOURS,
    ): array
    {
        $timestampKey = 'payments:fedapay:reconcile:last-run';
        $lockKey = 'payments:fedapay:reconcile:lock';
        $now = now();
        $lastRunAt = (int) Cache::get($timestampKey, 0);

        if ($lastRunAt > 0 && ($now->timestamp - $lastRunAt) < $cooldownSeconds) {
            return ['skipped' => true, 'reason' => 'cooldown'];
        }

        if (!Cache::add($lockKey, $now->timestamp, $cooldownSeconds)) {
            return ['skipped' => true, 'reason' => 'locked'];
        }

        Cache::put($timestampKey, $now->timestamp, $cooldownSeconds);

        try {
            return $this->reconcileUnsettledFedapayPayments($limit, $recentHours);
        } finally {
            Cache::forget($lockKey);
        }
    }

    public function reconcileUnsettledFedapayPayments(
        int $limit = self::DEFAULT_RECONCILE_LIMIT,
        int $recentHours = self::DEFAULT_RECONCILE_RECENT_HOURS,
    ): array
    {
        $payments = Payment::query()
            ->with(['vote', 'user'])
            ->where('provider', 'fedapay')
            ->whereNotNull('transaction_id')
            ->where(function ($query) use ($recentHours) {
                $query
                    ->whereIn('status', self::RECONCILE_STATUSES)
                    ->orWhere(function ($failedQuery) use ($recentHours) {
                        $failedQuery
                            ->where('status', 'failed')
                            ->where('updated_at', '>=', now()->subHours($recentHours));
                    })
                    ->orWhere(function ($successfulQuery) {
                        $successfulQuery
                            ->where('status', Payment::STATUS_SUCCEEDED)
                            ->where(function ($voteQuery) {
                                $voteQuery
                                    ->doesntHave('vote')
                                    ->orWhereHas('vote', function ($relatedVoteQuery) {
                                        $relatedVoteQuery
                                            ->where('status', '!=', Vote::STATUS_CONFIRMED)
                                            ->orWhereNull('user_id')
                                            ->orWhereNull('ip_address');
                                    });
                            });
                    });
            })
            ->orderBy('updated_at')
            ->limit($limit)
            ->get();

        $stats = [
            'inspected' => 0,
            'confirmed' => 0,
            'failed' => 0,
            'processing' => 0,
            'vote_repairs' => 0,
        ];

        foreach ($payments as $payment) {
            $beforePaymentStatus = $payment->status;
            $beforeVoteStatus = $payment->vote?->status;

            try {
                $payment = $this->syncPaymentWithProvider($payment, null, 'automatic-reconcile');
            } catch (\Throwable $exception) {
                logger()->warning('Automatic FedaPay reconciliation skipped a broken payment', [
                    'payment_id' => $payment->id,
                    'reference' => $payment->reference,
                    'error' => $exception->getMessage(),
                ]);
                continue;
            }

            $stats['inspected']++;

            if ($payment->status === Payment::STATUS_SUCCEEDED && $beforePaymentStatus !== Payment::STATUS_SUCCEEDED) {
                $stats['confirmed']++;
            } elseif ($payment->status === 'failed' && $beforePaymentStatus !== 'failed') {
                $stats['failed']++;
            } elseif (in_array($payment->status, self::RECONCILE_STATUSES, true)) {
                $stats['processing']++;
            }

            if ($beforeVoteStatus !== Vote::STATUS_CONFIRMED && $payment->vote?->status === Vote::STATUS_CONFIRMED) {
                $stats['vote_repairs']++;
            }
        }

        return $stats;
    }

    public function syncPaymentWithProvider(Payment $payment, ?array $remoteTransaction = null, ?string $source = null): Payment
    {
        $payment->loadMissing(['vote', 'user', 'transactions']);

        if ($payment->status === Payment::STATUS_SUCCEEDED) {
            return $this->reconcileSuccessfulPayment($payment, $remoteTransaction ?? []);
        }

        if (!$payment->transaction_id) {
            return $payment->fresh(['vote', 'user']);
        }

        if (!$remoteTransaction) {
            try {
                $remoteTransaction = $this->fedapay->retrieveTransaction($payment->transaction_id);
            } catch (\Throwable $exception) {
                logger()->warning('FedaPay provider sync failed', [
                    'payment_id' => $payment->id,
                    'reference' => $payment->reference,
                    'transaction_id' => $payment->transaction_id,
                    'source' => $source,
                    'error' => $exception->getMessage(),
                ]);

                return $payment->fresh(['vote', 'user']);
            }
        }

        $merchantReference = trim((string) Arr::get($remoteTransaction, 'merchant_reference', ''));
        if ($merchantReference !== '' && !hash_equals($payment->reference, $merchantReference)) {
            logger()->warning('FedaPay provider sync reference mismatch', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
                'remote_reference' => $merchantReference,
                'source' => $source,
            ]);

            return $payment->fresh(['vote', 'user']);
        }

        $outcome = $this->resolveTransactionOutcome($remoteTransaction);

        if ($outcome === 'succeeded') {
            $confirmedPayment = $this->confirm($payment->reference, $remoteTransaction);

            return ($confirmedPayment ?? $payment)->fresh(['vote', 'user']);
        }

        if ($outcome === 'failed') {
            if ($payment->status !== Payment::STATUS_SUCCEEDED) {
                $payment = $this->payments->updateStatus($payment, 'failed', $remoteTransaction);
            }

            return $this->reconcileFailedPayment($payment->fresh(['vote', 'user']), $remoteTransaction, $source);
        }

        if ($payment->status !== Payment::STATUS_SUCCEEDED) {
            $payment = $this->payments->updateStatus($payment, 'processing', $remoteTransaction);
        }

        return $payment->fresh(['vote', 'user']);
    }

    public function markPaymentAsFailed(Payment $payment, array $payload = [], ?string $source = null): Payment
    {
        if ($payment->status !== Payment::STATUS_SUCCEEDED) {
            $payment = $this->payments->updateStatus($payment, 'failed', $payload);
        }

        return $this->reconcileFailedPayment($payment->fresh(['vote', 'user']), $payload, $source);
    }

    public function recoverMissingVote(string $reference, int $candidateId): ?Payment
    {
        $payment = $this->payments->findByReference($reference);
        if (!$payment) {
            return null;
        }

        return $this->restoreMissingVoteForSucceededPayment($payment, $candidateId);
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

    private function reconcileSuccessfulPayment(Payment $payment, array $payload = []): Payment
    {
        $payment->loadMissing(['vote', 'user', 'transactions']);

        $resolvedUser = $payment->user ?: $this->resolveUserFromPayment($payment, $payload);
        $customerContext = $this->extractCustomerContext($payment, $payload, $resolvedUser);

        $paymentUpdates = [];

        if ($resolvedUser && (int) $payment->user_id !== (int) $resolvedUser->id) {
            $paymentUpdates['user_id'] = $resolvedUser->id;
        }

        $nextMeta = array_merge((array) ($payment->meta ?? []), $customerContext);
        if (($payment->meta ?? []) !== $nextMeta) {
            $paymentUpdates['meta'] = $nextMeta;
        }

        if ($paymentUpdates !== []) {
            $payment->update($paymentUpdates);
            $payment->refresh();
            $payment->loadMissing(['vote', 'user', 'transactions']);
        }

        $providerReference = $this->extractTransactionReference($payload) ?? $payment->transaction_id;
        if (
            $payment->status === Payment::STATUS_SUCCEEDED
            && !$payment->transactions->contains(fn ($transaction) => (string) $transaction->provider_reference === (string) $providerReference)
        ) {
            $this->transactions->create([
                'payment_id' => $payment->id,
                'type' => 'credit',
                'status' => 'succeeded',
                'amount' => $payment->amount,
                'currency' => $payment->currency,
                'provider_reference' => $providerReference,
                'payload' => $payload !== [] ? $payload : ($payment->payload ?? []),
            ]);
            $payment->refresh();
            $payment->loadMissing(['vote', 'user', 'transactions']);
        }

        if (!$payment->vote) {
            $payment = $this->restoreMissingVoteForSucceededPayment($payment);
        }

        if ($payment->vote) {
            $payment = $this->reconcileVoteForSucceededPayment($payment, $payload);
        }

        return $payment->fresh(['vote', 'user']);
    }

    private function restoreMissingVoteForSucceededPayment(Payment $payment, ?int $forcedCandidateId = null): Payment
    {
        $payment->loadMissing(['vote', 'user']);

        if ($payment->vote) {
            return $payment->fresh(['vote', 'user']);
        }

        $candidateId = $forcedCandidateId && $forcedCandidateId > 0
            ? $forcedCandidateId
            : (int) (
                data_get($payment->meta, 'candidate_id')
                ?: data_get($payment->payload, 'custom_metadata.candidate_id')
                ?: data_get($payment->payload, 'fedapay.custom_metadata.candidate_id')
                ?: 0
            );
        $candidateId = $this->resolveRestorableCandidateId($candidateId, $payment, $forcedCandidateId !== null);

        if ($candidateId <= 0) {
            logger()->warning('Succeeded payment cannot restore vote without candidate', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
            ]);

            return $payment->fresh(['vote', 'user']);
        }

        $quantity = max(1, (int) (
            data_get($payment->meta, 'quantity')
            ?: data_get($payment->payload, 'custom_metadata.quantity')
            ?: data_get($payment->payload, 'fedapay.custom_metadata.quantity')
            ?: 1
        ));
        $ipAddress = trim((string) data_get($payment->meta, 'ip', ''));

        DB::transaction(function () use ($payment, $candidateId, $quantity, $ipAddress): void {
            $lockedPayment = Payment::query()
                ->with(['vote', 'user'])
                ->lockForUpdate()
                ->find($payment->id);

            if (!$lockedPayment || $lockedPayment->vote) {
                return;
            }

            $existingVote = Vote::withTrashed()
                ->where('payment_id', $lockedPayment->id)
                ->first();

            $votePayload = [
                'user_id' => $lockedPayment->user_id,
                'candidate_id' => $candidateId,
                'amount' => (float) $lockedPayment->amount,
                'quantity' => $quantity,
                'currency' => $lockedPayment->currency,
                'status' => Vote::STATUS_CONFIRMED,
                'ip_address' => $ipAddress !== '' ? $ipAddress : null,
                'meta' => array_filter([
                    'recovered_from_payment' => true,
                    'payment_reference' => $lockedPayment->reference,
                    'candidate_name' => data_get($lockedPayment->meta, 'candidate_name'),
                    'unit_price' => data_get($lockedPayment->meta, 'unit_price'),
                    'submitted_amount' => data_get($lockedPayment->meta, 'submitted_amount'),
                ], static fn ($value) => $value !== null && $value !== ''),
            ];

            if ($existingVote) {
                if (method_exists($existingVote, 'trashed') && $existingVote->trashed()) {
                    $existingVote->restore();
                }

                $existingVote->update($votePayload);
                $vote = $existingVote->fresh();
            } else {
                $vote = Vote::create(array_merge($votePayload, [
                    'payment_id' => $lockedPayment->id,
                ]));
            }

            ActivityLog::create([
                'causer_id' => $vote->user_id ?: $lockedPayment->user_id,
                'causer_type' => \App\Models\User::class,
                'action' => 'vote_restored_from_payment',
                'ip_address' => $vote->ip_address,
                'meta' => array_filter([
                    'candidate_id' => $vote->candidate_id,
                    'vote_id' => $vote->id,
                    'quantity' => $vote->quantity,
                    'payment_id' => $lockedPayment->id,
                    'reference' => $lockedPayment->reference,
                ], static fn ($value) => $value !== null && $value !== ''),
                'status' => 'active',
            ]);
        });

        return $payment->fresh(['vote', 'user']);
    }

    private function reconcileFailedPayment(Payment $payment, array $payload = [], ?string $source = null): Payment
    {
        $payment->loadMissing(['vote', 'user']);

        if (!$payment->vote || $payment->vote->status === Vote::STATUS_CONFIRMED) {
            return $payment->fresh(['vote', 'user']);
        }

        $voteUpdates = $this->buildVoteContextUpdates($payment);
        $statusChanged = $payment->vote->status !== 'failed';

        if ($statusChanged) {
            $voteUpdates['status'] = 'failed';
        }

        if ($voteUpdates === []) {
            return $payment->fresh(['vote', 'user']);
        }

        DB::transaction(function () use ($payment, $voteUpdates, $statusChanged, $source) {
            $payment->vote->update($voteUpdates);

            if ($statusChanged) {
                ActivityLog::create([
                    'causer_id' => $payment->vote->user_id ?: $payment->user_id,
                    'causer_type' => \App\Models\User::class,
                    'action' => 'vote_failed',
                    'ip_address' => $payment->vote->ip_address ?: data_get($payment->meta, 'ip'),
                    'meta' => array_filter([
                        'candidate_id' => $payment->vote->candidate_id,
                        'vote_id' => $payment->vote->id,
                        'quantity' => $payment->vote->quantity,
                        'reason' => $source ?: 'payment_failed',
                        'payment_id' => $payment->id,
                    ], static fn ($value) => $value !== null && $value !== ''),
                    'status' => 'active',
                ]);
            }
        });

        return $payment->fresh(['vote', 'user']);
    }

    private function resolveRestorableCandidateId(int $candidateId, Payment $payment, bool $strict = false): int
    {
        if ($candidateId > 0 && Candidate::withTrashed()->whereKey($candidateId)->exists()) {
            return $candidateId;
        }

        if ($strict) {
            return 0;
        }

        $candidateName = trim((string) (
            data_get($payment->meta, 'candidate_name')
            ?: data_get($payment->payload, 'custom_metadata.candidate_name')
            ?: data_get($payment->payload, 'fedapay.custom_metadata.candidate_name')
            ?: ''
        ));

        if ($candidateName === '') {
            return 0;
        }

        $matchingIds = Candidate::withTrashed()
            ->select('id')
            ->whereRaw("TRIM(CONCAT(first_name, ' ', last_name)) = ?", [$candidateName])
            ->pluck('id');

        if ($matchingIds->count() === 1) {
            return (int) $matchingIds->first();
        }

        logger()->warning('Unable to resolve candidate for restored payment vote', [
            'payment_id' => $payment->id,
            'reference' => $payment->reference,
            'candidate_id' => $candidateId > 0 ? $candidateId : null,
            'candidate_name' => $candidateName,
            'matches' => $matchingIds->all(),
        ]);

        return 0;
    }

    private function reconcileVoteForSucceededPayment(Payment $payment, array $payload = []): Payment
    {
        if (!$payment->vote) {
            logger()->warning('Succeeded payment without linked vote during reconciliation', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
            ]);

            return $payment->fresh(['vote', 'user']);
        }

        $voteUpdates = $this->buildVoteContextUpdates($payment);
        $statusChanged = $payment->vote->status !== Vote::STATUS_CONFIRMED;

        if ($statusChanged) {
            $voteUpdates['status'] = Vote::STATUS_CONFIRMED;
        }

        if ($voteUpdates === []) {
            return $payment->fresh(['vote', 'user']);
        }

        DB::transaction(function () use ($payment, $voteUpdates, $statusChanged, $payload) {
            $payment->vote->update($voteUpdates);

            if ($statusChanged) {
                ActivityLog::create([
                    'causer_id' => $payment->vote->user_id ?: $payment->user_id,
                    'causer_type' => \App\Models\User::class,
                    'action' => 'vote_confirmed',
                    'ip_address' => $payment->vote->ip_address ?: data_get($payment->meta, 'ip'),
                    'meta' => array_filter([
                        'candidate_id' => $payment->vote->candidate_id,
                        'vote_id' => $payment->vote->id,
                        'quantity' => $payment->vote->quantity,
                        'payment_id' => $payment->id,
                        'source' => $this->extractTransactionReference($payload) ?: 'payment_reconcile',
                    ], static fn ($value) => $value !== null && $value !== ''),
                    'status' => 'active',
                ]);
            }
        });

        if ($statusChanged && ($payment->vote->user_id ?: $payment->user_id)) {
            SendVoteConfirmationJob::dispatch($payment->vote->id);
        }

        return $payment->fresh(['vote', 'user']);
    }

    private function buildVoteContextUpdates(Payment $payment): array
    {
        if (!$payment->vote) {
            return [];
        }

        $voteUpdates = [];

        if (!$payment->vote->user_id && $payment->user_id) {
            $voteUpdates['user_id'] = $payment->user_id;
        }

        if (!$payment->vote->ip_address) {
            $paymentIp = trim((string) data_get($payment->meta, 'ip', ''));
            if ($paymentIp !== '') {
                $voteUpdates['ip_address'] = $paymentIp;
            }
        }

        return $voteUpdates;
    }

    private function resolveTransactionOutcome(array $payload): string
    {
        $status = strtolower(trim((string) Arr::get($payload, 'status', '')));

        if (in_array($status, self::SUCCESS_STATUSES, true)) {
            return 'succeeded';
        }

        if (in_array($status, self::FAILURE_STATUSES, true)) {
            return 'failed';
        }

        if (in_array($status, self::PROCESSING_STATUSES, true) || $status === '') {
            return 'processing';
        }

        return 'processing';
    }

    private function resolveUserFromPayment(Payment $payment, array $payload = []): ?User
    {
        $emailCandidates = array_values(array_unique(array_filter([
            $payment->user?->email,
            data_get($payment->meta, 'voter_email'),
            data_get($payment->payload, 'customer.email'),
            data_get($payment->payload, 'fedapay.customer.email'),
            data_get($payload, 'customer.email'),
            data_get($payload, 'fedapay.customer.email'),
        ], static fn ($value) => filled($value))));

        foreach ($emailCandidates as $email) {
            $user = User::query()
                ->where('role', 'user')
                ->whereRaw('LOWER(email) = ?', [strtolower(trim((string) $email))])
                ->first();

            if ($user) {
                return $user;
            }
        }

        $phoneCandidates = array_values(array_unique(array_filter([
            $payment->user?->phone,
            data_get($payment->meta, 'voter_phone'),
            data_get($payment->payload, 'customer.phone_number'),
            data_get($payment->payload, 'fedapay.customer.phone_number'),
            data_get($payload, 'customer.phone_number'),
            data_get($payload, 'fedapay.customer.phone_number'),
        ], static fn ($value) => filled($value))));

        foreach ($phoneCandidates as $phone) {
            $variants = $this->phoneVariants((string) $phone);
            if ($variants === []) {
                continue;
            }

            $user = User::query()
                ->where('role', 'user')
                ->whereIn('phone', $variants)
                ->first();

            if ($user) {
                return $user;
            }
        }

        return null;
    }

    private function extractCustomerContext(Payment $payment, array $payload = [], ?User $resolvedUser = null): array
    {
        $firstname = trim((string) (
            data_get($payload, 'customer.firstname')
            ?? data_get($payload, 'fedapay.customer.firstname')
            ?? data_get($payment->payload, 'customer.firstname')
            ?? data_get($payment->payload, 'fedapay.customer.firstname')
            ?? ''
        ));
        $lastname = trim((string) (
            data_get($payload, 'customer.lastname')
            ?? data_get($payload, 'fedapay.customer.lastname')
            ?? data_get($payment->payload, 'customer.lastname')
            ?? data_get($payment->payload, 'fedapay.customer.lastname')
            ?? ''
        ));

        $resolvedName = trim(implode(' ', array_filter([$firstname, $lastname])));

        return array_filter([
            'voter_name' => $resolvedUser?->name ?: data_get($payment->meta, 'voter_name') ?: ($resolvedName !== '' ? $resolvedName : null),
            'voter_email' => $resolvedUser?->email
                ?: data_get($payment->meta, 'voter_email')
                ?: data_get($payload, 'customer.email')
                ?: data_get($payload, 'fedapay.customer.email')
                ?: data_get($payment->payload, 'customer.email')
                ?: data_get($payment->payload, 'fedapay.customer.email'),
            'voter_phone' => $resolvedUser?->phone
                ?: $this->normalizePhone((string) (
                    data_get($payment->meta, 'voter_phone')
                    ?: data_get($payload, 'customer.phone_number')
                    ?: data_get($payload, 'fedapay.customer.phone_number')
                    ?: data_get($payment->payload, 'customer.phone_number')
                    ?: data_get($payment->payload, 'fedapay.customer.phone_number')
                    ?: ''
                )),
        ], static fn ($value) => filled($value));
    }

    private function normalizePhone(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        if (!$digits) {
            return null;
        }

        if (str_starts_with($digits, '229') && strlen($digits) >= 11) {
            return '+' . $digits;
        }

        if (strlen($digits) === 8) {
            return '+229' . $digits;
        }

        return '+' . $digits;
    }

    private function phoneVariants(string $phone): array
    {
        $normalized = $this->normalizePhone($phone);
        if (!$normalized) {
            return [];
        }

        $digits = preg_replace('/\D+/', '', $normalized);
        $localDigits = str_starts_with($digits, '229') && strlen($digits) > 8
            ? substr($digits, -8)
            : $digits;

        return array_values(array_unique(array_filter([
            $normalized,
            $digits,
            $localDigits,
            '+'.$digits,
            '+229'.$localDigits,
            '229'.$localDigits,
            '+229 '.$localDigits,
            $localDigits !== '' ? implode(' ', str_split($localDigits, 2)) : null,
        ], static fn ($value) => filled($value))));
    }
}
