<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Repositories\CandidateRepository;
use Illuminate\Http\JsonResponse;

class PublicCandidateController extends Controller
{
    public function __construct(private CandidateRepository $candidates)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json($this->candidates->paginatePublic());
    }

    public function show(string $identifier): JsonResponse
    {
        $candidate = $this->candidates->findActiveByIdentifier($identifier);
        if (!$candidate) {
            return response()->json(['message' => 'Candidate not found'], 404);
        }

        return response()->json($candidate);
    }
}
