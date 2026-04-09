<?php

namespace App\Jobs;

use App\Models\Candidate;
use App\Services\CandidateImages\CandidateImagePipeline;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessCandidateImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 120;

    public function __construct(
        public readonly int $candidateId,
        public readonly string $originalPath,
    ) {
    }

    public function handle(CandidateImagePipeline $pipeline): void
    {
        $candidate = Candidate::find($this->candidateId);
        if (!$candidate) {
            return;
        }

        try {
            $pipeline->process($candidate, $this->originalPath);
        } catch (\Throwable $exception) {
            $pipeline->markFailed($candidate, $exception->getMessage());
            report($exception);
        }
    }
}
