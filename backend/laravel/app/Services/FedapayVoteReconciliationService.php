<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Candidate;
use App\Models\Payment;
use App\Models\Vote;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

class FedapayVoteReconciliationService
{
    public function __construct(
        private PaymentService $payments,
    ) {
    }

    public function inspectRemoteSuccessfulTransaction(array $remoteTransaction): array
    {
        $paymentMatch = $this->locatePayment($remoteTransaction);
        /** @var Payment|null $payment */
        $payment = $paymentMatch['payment'];
        $vote = $payment?->vote;

        $issue = 'ok';

        if ($paymentMatch['match_type'] === 'fuzzy') {
            $issue = 'local_missing_payment_fuzzy_match';
        } elseif (!$payment) {
            $issue = 'local_missing_payment';
        } elseif ($payment->status !== Payment::STATUS_SUCCEEDED) {
            $issue = 'local_not_succeeded';
        } elseif (!$vote) {
            $issue = 'local_missing_vote';
        } elseif ($vote->status !== Vote::STATUS_CONFIRMED) {
            $issue = 'local_vote_not_confirmed';
        } elseif ($this->hasCandidateConflict($remoteTransaction, $payment, $vote)) {
            $issue = 'candidate_conflict';
        }

        return [
            'issue' => $issue,
            'payment' => $payment,
            'vote' => $vote,
            'match_type' => $paymentMatch['match_type'],
            'match_count' => $paymentMatch['match_count'],
            'transaction_id' => $this->extractRemoteTransactionId($remoteTransaction),
            'reference' => $this->extractRemoteReference($remoteTransaction),
            'amount' => $this->extractRemoteAmount($remoteTransaction),
            'status' => $this->extractRemoteStatus($remoteTransaction),
            'paid_at' => $this->extractRemotePaidAt($remoteTransaction),
            'candidate_id' => $this->extractRemoteCandidateId($remoteTransaction),
            'candidate_name' => $this->extractRemoteCandidateName($remoteTransaction),
            'remote_candidate_id' => $this->extractRemoteCandidateId($remoteTransaction),
            'remote_candidate_name' => $this->extractRemoteCandidateName($remoteTransaction),
            'local_meta_candidate_id' => $this->extractPaymentCandidateId($payment),
            'local_meta_candidate_name' => $this->extractPaymentCandidateName($payment),
            'local_vote_candidate_id' => $vote?->candidate_id,
            'local_vote_candidate_name' => $this->extractVoteCandidateName($vote),
            'conflict_type' => $this->determineConflictType($remoteTransaction, $payment, $vote),
        ];
    }

    public function reconcileRemoteSuccessfulTransaction(array $remoteTransaction): array
    {
        $inspection = $this->inspectRemoteSuccessfulTransaction($remoteTransaction);
        /** @var Payment|null $beforePayment */
        $beforePayment = $inspection['payment'];
        /** @var Vote|null $beforeVote */
        $beforeVote = $inspection['vote'];

        if (in_array($inspection['issue'], ['local_missing_payment_fuzzy_match', 'candidate_conflict'], true)) {
            return array_merge($inspection, [
                'applied' => false,
                'outcome' => 'manual-review-required',
                'source_tagged' => false,
                'payment_created' => false,
                'payment_confirmed' => false,
                'vote_created' => false,
                'vote_confirmed' => false,
            ]);
        }

        $reconciledPayment = $this->payments->syncRemoteSuccessfulTransaction($remoteTransaction);

        if (!$reconciledPayment) {
            return array_merge($inspection, [
                'applied' => false,
                'outcome' => 'skipped',
                'source_tagged' => false,
                'payment_created' => false,
                'payment_confirmed' => false,
                'vote_created' => false,
                'vote_confirmed' => false,
            ]);
        }

        $reconciledPayment = $reconciledPayment->fresh(['vote', 'user']);
        $afterVote = $reconciledPayment->vote;

        $paymentCreated = !$beforePayment && (bool) $reconciledPayment->id;
        $paymentConfirmed = ($beforePayment?->status !== Payment::STATUS_SUCCEEDED)
            && $reconciledPayment->status === Payment::STATUS_SUCCEEDED;
        $voteCreated = !$beforeVote && (bool) $afterVote?->id;
        $voteConfirmed = ($beforeVote?->status !== Vote::STATUS_CONFIRMED)
            && $afterVote?->status === Vote::STATUS_CONFIRMED;

        $sourceTagged = false;

        if ($afterVote && ($inspection['issue'] !== 'ok' || $paymentCreated || $paymentConfirmed || $voteCreated || $voteConfirmed)) {
            $sourceTagged = $this->tagReconciledVote(
                $afterVote,
                $reconciledPayment,
                $remoteTransaction,
                $inspection,
            );
        }

        return array_merge($inspection, [
            'applied' => true,
            'outcome' => $reconciledPayment->vote?->status === Vote::STATUS_CONFIRMED ? 'reconciled' : 'partial',
            'payment' => $reconciledPayment,
            'vote' => $afterVote,
            'source_tagged' => $sourceTagged,
            'payment_created' => $paymentCreated,
            'payment_confirmed' => $paymentConfirmed,
            'vote_created' => $voteCreated,
            'vote_confirmed' => $voteConfirmed,
        ]);
    }

    private function locatePayment(array $remoteTransaction): array
    {
        $transactionId = $this->extractRemoteTransactionId($remoteTransaction);
        $reference = $this->extractRemoteReference($remoteTransaction);

        if ($transactionId) {
            $payment = Payment::withTrashed()
                ->with(['vote.candidate'])
                ->where('transaction_id', $transactionId)
                ->first();

            if ($payment) {
                return [
                    'payment' => $payment,
                    'match_type' => 'transaction_id',
                    'match_count' => 1,
                ];
            }
        }

        if ($reference) {
            $payment = Payment::withTrashed()
                ->with(['vote.candidate'])
                ->where('reference', $reference)
                ->first();

            if ($payment) {
                return [
                    'payment' => $payment,
                    'match_type' => 'reference',
                    'match_count' => 1,
                ];
            }
        }

        $fallbackPayments = $this->findFallbackPayments($remoteTransaction);

        return [
            'payment' => $fallbackPayments->count() === 1 ? $fallbackPayments->first() : null,
            'match_type' => $fallbackPayments->count() === 1 ? 'fuzzy' : 'none',
            'match_count' => $fallbackPayments->count(),
        ];
    }

    private function findFallbackPayments(array $remoteTransaction): \Illuminate\Support\Collection
    {
        $amount = $this->extractRemoteAmount($remoteTransaction);
        $paidAt = $this->extractRemotePaidAt($remoteTransaction);

        if ($amount <= 0 || !$paidAt) {
            return collect();
        }

        $email = strtolower(trim((string) Arr::get($remoteTransaction, 'custom_metadata.voter_email', '')));
        $phone = trim((string) Arr::get($remoteTransaction, 'custom_metadata.voter_phone', ''));
        $candidateId = $this->extractRemoteCandidateId($remoteTransaction);

        return Payment::withTrashed()
            ->with(['vote.candidate'])
            ->where('provider', 'fedapay')
            ->where('amount', $amount)
            ->whereBetween('created_at', [
                $paidAt->copy()->subDays(2),
                $paidAt->copy()->addDay(),
            ])
            ->get()
            ->filter(function (Payment $payment) use ($email, $phone, $candidateId): bool {
                $meta = (array) ($payment->meta ?? []);

                if ($email !== '' && strtolower(trim((string) ($meta['voter_email'] ?? ''))) !== $email) {
                    return false;
                }

                if ($phone !== '' && trim((string) ($meta['voter_phone'] ?? '')) !== $phone) {
                    return false;
                }

                if ($candidateId > 0 && (int) ($meta['candidate_id'] ?? 0) !== $candidateId) {
                    return false;
                }

                return true;
            })
            ->values();
    }

    private function tagReconciledVote(Vote $vote, Payment $payment, array $remoteTransaction, array $inspection): bool
    {
        $meta = (array) ($vote->meta ?? []);
        $currentSource = trim((string) ($meta['source'] ?? ''));
        $reconciliationMeta = (array) ($meta['reconciliation'] ?? []);

        $nextReconciliationMeta = array_merge($reconciliationMeta, array_filter([
            'provider' => 'fedapay',
            'command' => 'payments:reconcile-missing-fedapay-votes',
            'reason' => $inspection['issue'],
            'transaction_id' => $inspection['transaction_id'],
            'reference' => $inspection['reference'],
            'match_type' => $inspection['match_type'],
            'reconciled_at' => now()->toIso8601String(),
        ], static fn ($value) => $value !== null && $value !== ''));

        $changed = false;

        if ($currentSource !== 'reconciliation') {
            $meta['source'] = 'reconciliation';
            $changed = true;
        }

        if (($meta['reconciliation'] ?? null) !== $nextReconciliationMeta) {
            $meta['reconciliation'] = $nextReconciliationMeta;
            $changed = true;
        }

        if ($changed) {
            $vote->update(['meta' => $meta]);
        }

        if ($changed) {
            ActivityLog::create([
                'causer_id' => $vote->user_id ?: $payment->user_id,
                'causer_type' => \App\Models\User::class,
                'subject_id' => $vote->id,
                'subject_type' => Vote::class,
                'action' => 'vote_reconciled_from_fedapay',
                'ip_address' => $vote->ip_address ?: data_get($payment->meta, 'ip'),
                'meta' => array_filter([
                    'payment_id' => $payment->id,
                    'vote_id' => $vote->id,
                    'candidate_id' => $vote->candidate_id,
                    'transaction_id' => $inspection['transaction_id'],
                    'reference' => $inspection['reference'],
                    'reason' => $inspection['issue'],
                    'match_type' => $inspection['match_type'],
                ], static fn ($value) => $value !== null && $value !== ''),
                'status' => 'active',
            ]);

            logger()->info('FedaPay vote reconciliation applied', [
                'payment_id' => $payment->id,
                'vote_id' => $vote->id,
                'candidate_id' => $vote->candidate_id,
                'transaction_id' => $inspection['transaction_id'],
                'reference' => $inspection['reference'],
                'reason' => $inspection['issue'],
                'match_type' => $inspection['match_type'],
            ]);
        }

        return $changed;
    }

    private function hasCandidateConflict(array $remoteTransaction, Payment $payment, Vote $vote): bool
    {
        $remoteCandidateId = $this->extractRemoteCandidateId($remoteTransaction);

        if ($remoteCandidateId > 0 && (int) $vote->candidate_id !== $remoteCandidateId) {
            return true;
        }

        $remoteCandidateName = $this->extractRemoteCandidateName($remoteTransaction);
        $paymentCandidateName = trim((string) data_get($payment->meta, 'candidate_name', ''));

        return $remoteCandidateName !== ''
            && $paymentCandidateName !== ''
            && strcasecmp($remoteCandidateName, $paymentCandidateName) !== 0;
    }

    private function determineConflictType(array $remoteTransaction, ?Payment $payment, ?Vote $vote): ?string
    {
        if (!$payment || !$vote) {
            return null;
        }

        $types = [];
        $remoteCandidateId = $this->extractRemoteCandidateId($remoteTransaction);
        $remoteCandidateName = $this->extractRemoteCandidateName($remoteTransaction);
        $localMetaCandidateId = $this->extractPaymentCandidateId($payment);
        $localMetaCandidateName = $this->extractPaymentCandidateName($payment);
        $localVoteCandidateName = $this->extractVoteCandidateName($vote);

        if ($remoteCandidateId > 0 && (int) $vote->candidate_id !== $remoteCandidateId) {
            $types[] = 'vote_candidate_id_mismatch';
        }

        if ($remoteCandidateId > 0 && $localMetaCandidateId > 0 && $localMetaCandidateId !== $remoteCandidateId) {
            $types[] = 'payment_meta_candidate_id_mismatch';
        }

        if ($remoteCandidateName !== '' && $localVoteCandidateName !== '' && strcasecmp($remoteCandidateName, $localVoteCandidateName) !== 0) {
            $types[] = 'vote_candidate_name_mismatch';
        }

        if ($remoteCandidateName !== '' && $localMetaCandidateName !== '' && strcasecmp($remoteCandidateName, $localMetaCandidateName) !== 0) {
            $types[] = 'payment_meta_candidate_name_mismatch';
        }

        if ($types === []) {
            return null;
        }

        return implode(', ', $types);
    }

    private function extractPaymentCandidateId(?Payment $payment): ?int
    {
        if (!$payment) {
            return null;
        }

        $candidateId = (int) (
            data_get($payment->meta, 'candidate_id')
            ?: data_get($payment->payload, 'custom_metadata.candidate_id')
            ?: data_get($payment->payload, 'fedapay.custom_metadata.candidate_id')
            ?: 0
        );

        return $candidateId > 0 ? $candidateId : null;
    }

    private function extractPaymentCandidateName(?Payment $payment): string
    {
        if (!$payment) {
            return '';
        }

        return trim((string) (
            data_get($payment->meta, 'candidate_name')
            ?: data_get($payment->payload, 'custom_metadata.candidate_name')
            ?: data_get($payment->payload, 'fedapay.custom_metadata.candidate_name')
            ?: ''
        ));
    }

    private function extractVoteCandidateName(?Vote $vote): string
    {
        if (!$vote) {
            return '';
        }

        /** @var Candidate|null $candidate */
        $candidate = $vote->relationLoaded('candidate') ? $vote->candidate : $vote->candidate()->first();

        if (!$candidate) {
            return '';
        }

        return trim(implode(' ', array_filter([
            trim((string) $candidate->first_name),
            trim((string) $candidate->last_name),
        ], static fn (string $value) => $value !== '')));
    }

    private function extractRemoteTransactionId(array $remoteTransaction): ?string
    {
        $candidates = [
            data_get($remoteTransaction, 'id'),
            data_get($remoteTransaction, 'data.id'),
            data_get($remoteTransaction, 'transaction.id'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function extractRemoteReference(array $remoteTransaction): ?string
    {
        $candidates = [
            data_get($remoteTransaction, 'merchant_reference'),
            data_get($remoteTransaction, 'custom_metadata.payment_reference'),
            data_get($remoteTransaction, 'reference'),
            data_get($remoteTransaction, 'data.merchant_reference'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function extractRemoteAmount(array $remoteTransaction): float
    {
        return round((float) (
            data_get($remoteTransaction, 'amount')
            ?: data_get($remoteTransaction, 'data.amount')
            ?: 0
        ), 2);
    }

    private function extractRemoteStatus(array $remoteTransaction): string
    {
        return strtolower(trim((string) (
            data_get($remoteTransaction, 'status')
            ?: data_get($remoteTransaction, 'data.status')
            ?: ''
        )));
    }

    private function extractRemoteCandidateId(array $remoteTransaction): int
    {
        return (int) (
            data_get($remoteTransaction, 'custom_metadata.candidate_id')
            ?: data_get($remoteTransaction, 'metadata.candidate_id')
            ?: data_get($remoteTransaction, 'data.custom_metadata.candidate_id')
            ?: 0
        );
    }

    private function extractRemoteCandidateName(array $remoteTransaction): string
    {
        $candidateName = trim((string) (
            data_get($remoteTransaction, 'custom_metadata.candidate_name')
            ?: data_get($remoteTransaction, 'metadata.candidate_name')
            ?: data_get($remoteTransaction, 'data.custom_metadata.candidate_name')
            ?: ''
        ));

        if ($candidateName !== '') {
            return preg_replace('/\s+/', ' ', $candidateName) ?: $candidateName;
        }

        $description = trim((string) (
            data_get($remoteTransaction, 'description')
            ?: data_get($remoteTransaction, 'data.description')
            ?: ''
        ));

        if ($description !== '' && preg_match('/^Vote pour\s+(.+)$/iu', $description, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }

        return '';
    }

    private function extractRemotePaidAt(array $remoteTransaction): ?Carbon
    {
        $candidates = [
            data_get($remoteTransaction, 'approved_at'),
            data_get($remoteTransaction, 'transferred_at'),
            data_get($remoteTransaction, 'updated_at'),
            data_get($remoteTransaction, 'created_at'),
            data_get($remoteTransaction, 'data.updated_at'),
            data_get($remoteTransaction, 'data.created_at'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value === '') {
                continue;
            }

            try {
                return Carbon::parse($value);
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }
}
