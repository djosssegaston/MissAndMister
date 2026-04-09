<?php

namespace App\Contracts;

use App\Support\CandidateFaceBox;

interface CandidateFaceDetector
{
    public function detect(string $absolutePath): ?CandidateFaceBox;
}
