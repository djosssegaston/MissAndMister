<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendVoteConfirmationJob implements ShouldQueue
{
    use Queueable;

    public function __construct(private int $voteId)
    {
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $vote = \App\Models\Vote::find($this->voteId);
        if (!$vote || !$vote->user) {
            return;
        }

        app(\App\Services\NotificationService::class)->send(
            $vote->user,
            'Vote confirmé',
            'Votre vote a été enregistré avec succès.',
            ['candidate_id' => $vote->candidate_id]
        );
    }
}
