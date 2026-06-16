<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSocialProjectRequest;
use App\Models\Candidate;
use App\Models\SocialProject;
use App\Services\PublicApiPayloadService;
use Illuminate\Http\JsonResponse;

class SocialProjectController extends Controller
{
    public function __construct(
        private PublicApiPayloadService $publicApi,
    ) {}

    public function publicIndex(): JsonResponse
    {
        $projects = SocialProject::query()
            ->with(['candidate1', 'candidate2'])
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => $projects->map(fn (SocialProject $project) => $this->serialize($project))->values(),
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        $projects = SocialProject::query()
            ->with(['candidate1', 'candidate2', 'creator'])
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => $projects->map(fn (SocialProject $project) => $this->serialize($project, true))->values(),
        ]);
    }

    public function show(SocialProject $socialProject): JsonResponse
    {
        $socialProject->load(['candidate1', 'candidate2', 'creator']);

        return response()->json([
            'data' => $this->serialize($socialProject, true),
        ]);
    }

    public function store(StoreSocialProjectRequest $request): JsonResponse
    {
        $project = SocialProject::create([
            'name' => trim($request->input('name')),
            'candidate1_id' => $request->input('candidate1_id'),
            'candidate2_id' => $request->input('candidate2_id'),
            'theme' => trim($request->input('theme')),
            'created_by' => $request->user()?->id,
        ]);

        $project->load(['candidate1', 'candidate2', 'creator']);
        $this->publicApi->invalidatePublicData();

        return response()->json([
            'success' => true,
            'message' => 'Binôme créé avec succès.',
            'project' => $this->serialize($project, true),
        ], 201);
    }

    public function update(StoreSocialProjectRequest $request, SocialProject $socialProject): JsonResponse
    {
        $socialProject->update([
            'name' => trim($request->input('name')),
            'candidate1_id' => $request->input('candidate1_id'),
            'candidate2_id' => $request->input('candidate2_id'),
            'theme' => trim($request->input('theme')),
            'created_by' => $request->user()?->id,
        ]);

        $socialProject->load(['candidate1', 'candidate2', 'creator']);
        $this->publicApi->invalidatePublicData();

        return response()->json([
            'success' => true,
            'message' => 'Binôme mis à jour avec succès.',
            'project' => $this->serialize($socialProject, true),
        ]);
    }

    public function destroy(SocialProject $socialProject): JsonResponse
    {
        $socialProject->delete();
        $this->publicApi->invalidatePublicData();

        return response()->json([
            'success' => true,
            'message' => 'Binôme supprimé avec succès.',
        ]);
    }

    public function availableCandidates(): JsonResponse
    {
        $assignedIds = SocialProject::query()
            ->whereNull('deleted_at')
            ->get(['candidate1_id', 'candidate2_id'])
            ->flatMap(fn ($p) => [$p->candidate1_id, $p->candidate2_id])
            ->unique()
            ->values();

        $candidates = Candidate::query()
            ->where('status', 'active')
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        return response()->json([
            'data' => $candidates->map(fn (Candidate $c) => [
                'id' => $c->id,
                'full_name' => trim($c->first_name.' '.$c->last_name),
                'first_name' => $c->first_name,
                'last_name' => $c->last_name,
                'university' => $c->university,
                'photo_url' => $c->photo_url,
                'photo_urls' => $c->photo_urls,
                'already_assigned' => $assignedIds->contains($c->id),
            ])->values(),
        ]);
    }

    private function serialize(SocialProject $project, bool $includeAdmin = false): array
    {
        $candidate1 = $project->candidate1;
        $candidate2 = $project->candidate2;

        return [
            'id' => $project->id,
            'name' => $project->name,
            'theme' => $project->theme,
            'candidate1' => $candidate1 ? [
                'id' => $candidate1->id,
                'first_name' => $candidate1->first_name,
                'last_name' => $candidate1->last_name,
                'full_name' => trim($candidate1->first_name.' '.$candidate1->last_name),
                'university' => $candidate1->university,
                'photo_url' => $candidate1->photo_url,
                'photo_urls' => $candidate1->photo_urls,
                'bio' => $candidate1->bio,
            ] : null,
            'candidate2' => $candidate2 ? [
                'id' => $candidate2->id,
                'first_name' => $candidate2->first_name,
                'last_name' => $candidate2->last_name,
                'full_name' => trim($candidate2->first_name.' '.$candidate2->last_name),
                'university' => $candidate2->university,
                'photo_url' => $candidate2->photo_url,
                'photo_urls' => $candidate2->photo_urls,
                'bio' => $candidate2->bio,
            ] : null,
            'created_by' => $includeAdmin && $project->creator
                ? ['id' => $project->creator->id, 'name' => $project->creator->name]
                : null,
            'created_at' => $project->created_at?->toIso8601String(),
            'updated_at' => $project->updated_at?->toIso8601String(),
        ];
    }
}
