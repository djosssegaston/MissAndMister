<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\Setting;
use App\Models\Vote;
use App\Repositories\VoteRepository;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VoteService
{
    private const DEFAULT_PRICE_PER_VOTE = 500;

    public function __construct(
        private VoteRepository $votes,
        private PaymentService $payments,
        private FraudDetectionService $fraudDetection,
        private PublicApiPayloadService $publicApi,
    ) {
    }

    public function initiateVote(?int $userId, int $candidateId, string $currency, string $ip, array $meta = [], int $quantity = 1): array
    {
        $this->fraudDetection->assertNotFraudulent($userId, $ip, $quantity);

        $candidate = Candidate::query()->find($candidateId);
        $candidateName = $candidate ? trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? '')) : null;
        $unitPrice = $this->resolvePricePerVote();
        $amount = $unitPrice * max(1, $quantity);
        $submittedAmount = data_get($meta, 'submitted_amount');

        if (is_numeric($submittedAmount) && abs(((float) $submittedAmount) - $amount) > 0.01) {
            Log::warning('Vote amount mismatch detected; server amount applied', [
                'user_id' => $userId,
                'candidate_id' => $candidateId,
                'submitted_amount' => (float) $submittedAmount,
                'server_amount' => $amount,
                'quantity' => $quantity,
                'ip' => $ip,
            ]);
        }

        $payment = $this->payments->initiate($userId, $amount, $currency, array_merge($meta, [
            'ip' => $ip,
            'candidate_id' => $candidateId,
            'candidate_name' => $candidateName,
            'unit_price' => $unitPrice,
        ]));

        // Create pending vote linked to payment
        $vote = $this->votes->create([
            'user_id' => $userId,
            'candidate_id' => $candidateId,
            'payment_id' => $payment->id,
            'amount' => $amount,
            'quantity' => $quantity,
            'currency' => $currency,
            'status' => 'pending',
            'ip_address' => $ip,
            'meta' => $meta,
        ]);

        ActivityLog::create([
            'causer_id' => $userId,
            'causer_type' => \App\Models\User::class,
            'action' => 'vote_initiated',
            'ip_address' => $ip,
            'meta' => ['candidate_id' => $candidateId, 'payment_id' => $payment->id, 'quantity' => $quantity],
            'status' => 'active',
        ]);

        return [$payment, $vote];
    }

    private function resolvePricePerVote(): int
    {
        $configuredPrice = (int) Setting::query()
            ->where('key', 'price_per_vote')
            ->where('status', 'active')
            ->value('value');

        return $configuredPrice > 0 ? $configuredPrice : self::DEFAULT_PRICE_PER_VOTE;
    }

    public function confirmVote(Vote $vote): Vote
    {
        if ($vote->status === 'confirmed') {
            return $vote;
        }

        $confirmedVote = DB::transaction(function () use ($vote) {
            $vote->loadMissing('payment');

            $updates = ['status' => 'confirmed'];

            if (!$vote->user_id && $vote->payment?->user_id) {
                $updates['user_id'] = $vote->payment->user_id;
            }

            if (!$vote->ip_address) {
                $paymentIp = data_get($vote->payment?->meta, 'ip');
                if (filled($paymentIp)) {
                    $updates['ip_address'] = (string) $paymentIp;
                }
            }

            $vote->update($updates);

            ActivityLog::create([
                'causer_id' => $vote->user_id,
                'causer_type' => \App\Models\User::class,
                'action' => 'vote_confirmed',
                'ip_address' => $vote->ip_address,
                'meta' => ['candidate_id' => $vote->candidate_id, 'vote_id' => $vote->id, 'quantity' => $vote->quantity],
                'status' => 'active',
            ]);

            return $vote;
        });

        $this->publicApi->invalidateVotingData();

        return $confirmedVote;
    }

    public function failVote(Vote $vote, ?string $reason = null): Vote
    {
        if ($vote->status === 'failed') {
            return $vote;
        }

        return DB::transaction(function () use ($vote, $reason) {
            $vote->update(['status' => 'failed']);

            ActivityLog::create([
                'causer_id' => $vote->user_id,
                'causer_type' => \App\Models\User::class,
                'action' => 'vote_failed',
                'ip_address' => $vote->ip_address,
                'meta' => array_filter([
                    'candidate_id' => $vote->candidate_id,
                    'vote_id' => $vote->id,
                    'quantity' => $vote->quantity,
                    'reason' => $reason,
                ], static fn ($value) => $value !== null && $value !== ''),
                'status' => 'active',
            ]);

            return $vote;
        });
    }
}
