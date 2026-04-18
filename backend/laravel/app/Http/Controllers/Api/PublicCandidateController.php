<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Repositories\CandidateRepository;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;

class PublicCandidateController extends Controller
{
    public function __construct(
        private CandidateRepository $candidates,
        private PaymentService $payments,
    )
    {
    }

    public function index(): JsonResponse
    {
        $this->payments->scheduleWarmPaymentStateForReadModels();
        $paginator = $this->candidates->paginatePublic();
        $paginator->setCollection(
            $paginator->getCollection()->map(fn (Candidate $candidate) => $this->presentCandidate($candidate))
        );

        return response()->json($paginator);
    }

    public function show(string $identifier): JsonResponse
    {
        $this->payments->scheduleWarmPaymentStateForReadModels();
        $candidate = $this->candidates->findActiveByIdentifier($identifier);
        if (!$candidate) {
            return response()->json(['message' => 'Candidate not found'], 404);
        }

        return response()->json($this->presentCandidate($candidate));
    }

    private function presentCandidate(Candidate $candidate): array
    {
        $data = $candidate->toArray();
        unset($data['id'], $data['deleted_at']);

        if (isset($data['category']) && is_array($data['category'])) {
            unset($data['category']['id']);
        }

        return $data;
    }
}
