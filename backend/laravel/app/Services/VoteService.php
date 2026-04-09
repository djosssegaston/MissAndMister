<?php

namespace App\Services;

use App\Models\Vote;
use App\Repositories\VoteRepository;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\DB;

class VoteService
{
    public function __construct(
        private VoteRepository $votes,
        private PaymentService $payments,
        private FraudDetectionService $fraudDetection,
    ) {
    }

    public function initiateVote(?int $userId, int $candidateId, float $amount, string $currency, string $ip, array $meta = [], int $quantity = 1): array
    {
        $this->fraudDetection->assertNotFraudulent($userId, $ip, $quantity);

        $payment = $this->payments->initiate($userId, $amount, $currency, array_merge($meta, ['ip' => $ip]));

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

    public function confirmVote(Vote $vote): Vote
    {
        return DB::transaction(function () use ($vote) {
            $vote->update(['status' => 'confirmed']);

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
    }
}
