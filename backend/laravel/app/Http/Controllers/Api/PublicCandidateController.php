<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Repositories\CandidateRepository;
use App\Services\PaymentService;
use App\Services\PublicApiPayloadService;
use Illuminate\Http\JsonResponse;

class PublicCandidateController extends Controller
{
    public function __construct(
        private CandidateRepository $candidates,
        private PaymentService $payments,
        private PublicApiPayloadService $publicApi,
    )
    {
    }

    public function index(): JsonResponse
    {
        $this->payments->scheduleWarmPaymentStateForReadModels();
        $perPage = max(12, min((int) request()->integer('per_page', 50), 50));
        $category = trim((string) request()->query('category', ''));

        return response()->json(
            $this->publicApi->paginatedCandidatesPayload($perPage, $category !== '' ? $category : null)
        );
    }

    public function show(string $identifier): JsonResponse
    {
        $this->payments->scheduleWarmPaymentStateForReadModels();
        $payload = cache()->remember('public:candidates:show:' . md5($identifier), now()->addSeconds(60), function () use ($identifier) {
            $candidate = $this->candidates->findActiveByIdentifier($identifier);

            if (!$candidate) {
                return null;
            }

            return $this->presentDetailCandidate($candidate);
        });

        if (!$payload) {
            return response()->json(['message' => 'Candidate not found'], 404);
        }

        return response()->json($payload);
    }

    private function presentListCandidate(Candidate $candidate): array
    {
        $photoUrls = (array) $candidate->photo_urls;

        return [
            'public_uid' => $candidate->public_uid,
            'slug' => $candidate->slug,
            'first_name' => $candidate->first_name,
            'last_name' => $candidate->last_name,
            'public_number' => $candidate->public_number,
            'university' => $candidate->university,
            'votes_count' => (int) ($candidate->votes_count ?? 0),
            'photo_url' => $candidate->photo_url,
            'photo_urls' => array_filter([
                'thumbnail' => $photoUrls['thumbnail'] ?? null,
                'medium' => $photoUrls['medium'] ?? null,
            ]),
            'category' => [
                'name' => $candidate->category?->name,
            ],
        ];
    }

    private function presentDetailCandidate(Candidate $candidate): array
    {
        $data = $candidate->toArray();
        unset($data['id'], $data['deleted_at']);

        if (isset($data['category']) && is_array($data['category'])) {
            unset($data['category']['id']);
        }

        $data['votes_count'] = (int) ($candidate->votes_count ?? 0);
        $data['rank_in_category'] = $this->candidates->resolveRankInCategory($candidate);

        return $data;
    }
}
