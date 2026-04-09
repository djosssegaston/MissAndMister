<?php

namespace App\Services\CandidateImages;

use App\Contracts\CandidateFaceDetector;
use App\Support\CandidateFaceBox;
use RuntimeException;

class NullCandidateFaceDetector implements CandidateFaceDetector
{
    public function __construct(
        private readonly string $message = 'Le service de detection de visage n’est pas configure.',
    ) {
    }

    public function detect(string $absolutePath): ?CandidateFaceBox
    {
        throw new RuntimeException($this->message);
    }
}
