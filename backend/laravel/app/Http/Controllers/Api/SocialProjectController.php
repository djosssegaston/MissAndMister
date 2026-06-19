<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSocialProjectRequest;
use App\Models\Candidate;
use App\Models\SocialProject;
use App\Services\Media\CloudinaryMediaService;
use App\Services\PublicApiPayloadService;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class SocialProjectController extends Controller
{
    public function __construct(
        private PublicApiPayloadService $publicApi,
        private CloudinaryMediaService $cloudinaryMedia,
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

    public function uploadCandidatePhoto(Request $request, SocialProject $socialProject): JsonResponse
    {
        $request->validate([
            'candidate' => ['required', 'integer', 'in:1,2'],
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ], [
            'candidate.required' => 'Le numéro du candidat est requis.',
            'candidate.in' => 'Le candidat doit être 1 ou 2.',
            'photo.required' => 'Veuillez sélectionner une photo.',
            'photo.image' => 'Le fichier choisi doit être une image valide.',
            'photo.mimes' => 'La photo doit être au format JPG, JPEG, PNG ou WebP.',
            'photo.max' => 'La photo ne doit pas dépasser 20 Mo.',
        ]);

        $candidateNum = (int) $request->input('candidate');
        $column = "candidate{$candidateNum}_photo_path";
        $currentPath = $socialProject->{$column};

        $this->deleteStoredPhoto($currentPath);

        [$path, $meta] = $this->storePhoto($request->file('photo'), $candidateNum);

        $socialProject->forceFill([$column => $path])->save();
        $this->publicApi->invalidatePublicData();

        return response()->json([
            'success' => true,
            'message' => 'Photo du candidat '.$candidateNum.' mise à jour avec succès.',
            'photo_url' => MediaUrl::fromPath($path),
        ]);
    }

    public function deleteCandidatePhoto(Request $request, SocialProject $socialProject): JsonResponse
    {
        $request->validate([
            'candidate' => ['required', 'integer', 'in:1,2'],
        ]);

        $candidateNum = (int) $request->input('candidate');
        $column = "candidate{$candidateNum}_photo_path";

        $this->deleteStoredPhoto($socialProject->{$column});
        $socialProject->forceFill([$column => null])->save();
        $this->publicApi->invalidatePublicData();

        return response()->json([
            'success' => true,
            'message' => 'Photo du candidat '.$candidateNum.' supprimée.',
        ]);
    }

    private function storePhoto(UploadedFile $photo, int $candidateNum): array
    {
        if ($this->cloudinaryMedia->enabled()) {
            $realPath = $photo->getRealPath();

            if (! $realPath) {
                throw new \RuntimeException('Impossible d\'accéder au fichier photo temporaire.');
            }

            $upload = $this->cloudinaryMedia->uploadFile($realPath, [
                'resource_type' => 'image',
                'folder' => 'social-projects',
                'public_id' => 'candidat-'.$candidateNum.'-'.$photo->hashName(),
                'overwrite' => true,
                'invalidate' => true,
            ]);

            return [$upload['url'], [
                'storage' => 'cloudinary',
                'size' => $upload['bytes'] ?? $photo->getSize(),
                'mime' => $photo->getMimeType(),
                'original_name' => $photo->getClientOriginalName(),
                'cloudinary' => $upload,
            ]];
        }

        $path = $photo->store('social-projects', 'public');

        return [$path, [
            'storage' => 'local',
            'size' => $photo->getSize(),
            'mime' => $photo->getMimeType(),
            'original_name' => $photo->getClientOriginalName(),
        ]];
    }

    private function deleteStoredPhoto(?string $path): void
    {
        if (! $path) {
            return;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return;
        }

        $storagePath = MediaUrl::toStorageRelativePath($path);
        if ($storagePath !== null) {
            Storage::disk('public')->delete($storagePath);
        }
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
            'candidate1_photo_url' => $project->candidate1_photo_url,
            'candidate2_photo_url' => $project->candidate2_photo_url,
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
