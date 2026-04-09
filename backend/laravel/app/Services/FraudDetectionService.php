<?php

namespace App\Services;

use App\Models\FraudReport;
use App\Repositories\VoteRepository;
use Illuminate\Validation\ValidationException;

class FraudDetectionService
{
    public function __construct(private VoteRepository $votes)
    {
    }

    public function assertNotFraudulent(?int $userId, string $ip, int $quantity = 1): void
    {
        $limitPerUser = (int) config('services.fraud.limit_per_user', 100);
        $limitPerIp = (int) config('services.fraud.limit_per_ip', 200);

                $userVotesToday = $userId ? $this->votes->countUserVotesToday($userId) : 0;
        $ipVotesToday = $this->votes->countIpVotesToday($ip);

                if ($userId && ($userVotesToday + $quantity > $limitPerUser)) {
            $this->report($userId, null, $ip, 80, 'User daily vote limit reached');
            throw ValidationException::withMessages(['votes' => 'Daily vote limit reached']);
        }

        if ($ipVotesToday + $quantity > $limitPerIp) {
            $this->report($userId, null, $ip, 60, 'IP daily vote limit reached');
            throw ValidationException::withMessages(['votes' => 'IP vote limit reached']);
        }
    }

    public function report(?int $userId, ?int $voteId, ?string $ip, int $score, string $reason): FraudReport
    {
        return FraudReport::create([
            'user_id' => $userId,
            'vote_id' => $voteId,
            'ip_address' => $ip,
            'score' => $score,
            'reason' => $reason,
            'status' => $score >= 80 ? 'blocked' : 'pending',
            'signals' => ['reason' => $reason],
        ]);
    }
}
