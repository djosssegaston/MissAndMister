<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCandidateRequest;
use App\Http\Requests\UpdateCandidateRequest;
use App\Jobs\ProcessCandidateImage;
use App\Models\Candidate;
use App\Repositories\CandidateRepository;
use App\Services\CandidateAccountService;
use App\Services\CandidateImages\CandidateImagePipeline;
use App\Services\Media\CloudinaryMediaService;
use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CandidateController extends Controller
{
    private const PHOTO_UPLOAD_LIMIT_LABEL = '20 Mo';

    public function __construct(
        private CandidateRepository $candidates,
        private CandidateAccountService $candidateAccounts,
        private CandidateImagePipeline $candidateImagePipeline,
        private CloudinaryMediaService $cloudinaryMedia,
    )
    {
    }

    /**
     * Display a listing of the resource.
     */
    // Public listing (active only)
    public function index(): JsonResponse
    {
        return response()->json($this->candidates->paginatePublic());
    }

    // Admin listing (all statuses)
    public function adminIndex(): JsonResponse
    {
        return response()->json($this->candidates->paginateAll());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCandidateRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['slug'] = Str::slug($data['first_name'] . ' ' . $data['last_name'] . '-' . Str::random(4));
        $data['description'] = $data['description'] ?? $data['bio'] ?? null;
        $data['is_active'] = $data['is_active'] ?? ($data['status'] ?? 'active') === 'active';
        $data['status'] = ($data['is_active'] ?? true) ? 'active' : 'inactive';

        $candidate = $this->candidateAccounts->create($data);

        return response()->json([
            'success' => true,
            'message' => 'Candidat créé',
            'candidate' => $candidate,
            'photo_url' => MediaUrl::fromPath($candidate->photo_path),
            'photo_urls' => $candidate->photo_urls,
            'video_url' => MediaUrl::fromPath($candidate->video_path),
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Candidate $candidate): JsonResponse
    {
        return response()->json($candidate->load('category'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCandidateRequest $request, Candidate $candidate): JsonResponse
    {
        $data = $request->validated();
        $this->authorize('update', $candidate);
        $existingVideoPath = $candidate->video_path;
        $existingVideoMeta = (array) ($candidate->video_meta ?? []);
        $data['description'] = $data['description'] ?? $data['bio'] ?? $candidate->description;
        if (array_key_exists('is_active', $data)) {
            $data['status'] = $data['is_active'] ? 'active' : 'inactive';
        }
        $updated = $this->candidateAccounts->update($candidate, $data);

        if (array_key_exists('video_path', $data) && blank($data['video_path']) && $existingVideoPath) {
            $this->deleteStoredVideo($existingVideoPath, $existingVideoMeta);
            $updated->forceFill(['video_meta' => null])->save();
            $updated->refresh();
        }

        return response()->json([
            'success' => true,
            'message' => 'Candidat mis à jour',
            'candidate' => $updated,
            'photo_url' => MediaUrl::fromPath($updated->photo_path),
            'photo_urls' => $updated->photo_urls,
            'video_url' => MediaUrl::fromPath($updated->video_path),
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Candidate $candidate): JsonResponse
    {
        $this->authorize('delete', $candidate);
        $this->candidateAccounts->deactivate($candidate);

        return response()->json([
            'message' => 'Candidat désactivé',
            'candidate' => $candidate->fresh(),
        ]);
    }

    public function uploadPhoto(Request $request, Candidate $candidate): JsonResponse
    {
        $this->authorize('update', $candidate);

        if ($invalidUpload = $this->invalidUploadResponse($request->file('photo'), 'photo', 'La photo', self::PHOTO_UPLOAD_LIMIT_LABEL)) {
            return $invalidUpload;
        }

        $data = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ], [
            'photo.required' => 'Veuillez sélectionner une photo.',
            'photo.image' => 'Le fichier choisi doit être une image valide.',
            'photo.mimes' => 'La photo doit être au format JPG, JPEG, PNG ou WebP.',
            'photo.max' => 'La photo ne doit pas dépasser 20 Mo.',
            'photo.uploaded' => 'Le serveur a refusé l’envoi de la photo. Vérifiez la taille du fichier puis réessayez.',
        ]);

        if ($this->usesCloudinaryMedia()) {
            $realPath = $data['photo']->getRealPath();

            if (!$realPath) {
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible d’accéder à la photo temporaire envoyée.',
                ], 422);
            }

            try {
                $meta = $this->candidateImagePipeline->validateUpload($realPath);
            } catch (\RuntimeException $exception) {
                return response()->json([
                    'success' => false,
                    'message' => $exception->getMessage(),
                ], 503);
            }

            $candidate->forceFill([
                'photo_processing_status' => 'queued',
                'photo_processing_error' => null,
                'photo_meta' => array_merge((array) ($candidate->photo_meta ?? []), $meta),
            ])->save();

            return $this->processTemporaryPhotoSynchronously(
                $candidate,
                $realPath,
                $data['photo']->getClientOriginalName(),
            );
        }

        $diskName = config('candidate_images.disk', 'public');
        $disk = Storage::disk($diskName);
        $path = $data['photo']->store('candidate-images/originals', $diskName);

        try {
            $meta = $this->candidateImagePipeline->validateUpload($disk->path($path));
        } catch (ValidationException $exception) {
            $disk->delete($path);
            throw $exception;
        } catch (\RuntimeException $exception) {
            $disk->delete($path);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 503);
        }

        $candidate->forceFill([
            'photo_original_path' => $path,
            'photo_processing_status' => 'queued',
            'photo_processing_error' => null,
            'photo_meta' => array_merge((array) ($candidate->photo_meta ?? []), $meta),
        ])->save();

        if (config('candidate_images.async_processing', false)) {
            try {
                ProcessCandidateImage::dispatch($candidate->id, $path)
                    ->onQueue(config('candidate_images.queue', 'images'));

                $candidate->refresh();

                return response()->json([
                    'success' => true,
                    'processing' => true,
                    'message' => 'Photo recue. Traitement automatique en cours.',
                    'candidate' => $candidate,
                    'photo_path' => $candidate->photo_path,
                    'photo_url' => MediaUrl::fromPath($candidate->photo_path),
                    'photo_urls' => $candidate->photo_urls,
                ], 202);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return $this->processPhotoSynchronously($candidate, $path);
    }

    public function uploadVideo(Request $request, Candidate $candidate): JsonResponse
    {
        $this->authorize('update', $candidate);

        if ($invalidUpload = $this->invalidUploadResponse($request->file('video'), 'video', 'La vidéo', $this->videoUploadLimitLabel())) {
            return $invalidUpload;
        }

        $videoLimitLabel = $this->videoUploadLimitLabel();

        $data = $request->validate([
            'video' => ['required', 'file', 'mimes:mp4,mov,m4v,webm', 'max:' . $this->videoUploadMaxSizeKilobytes()],
        ], [
            'video.required' => 'Veuillez sélectionner une vidéo.',
            'video.file' => 'Le fichier choisi doit être une vidéo valide.',
            'video.mimes' => 'La vidéo doit être au format MP4, MOV, M4V ou WebM.',
            'video.max' => "La vidéo ne doit pas dépasser {$videoLimitLabel}.",
            'video.uploaded' => 'Le serveur a refusé l’envoi de la vidéo. Vérifiez la taille du fichier puis réessayez.',
        ]);

        $previousVideoPath = $candidate->video_path;
        $previousVideoMeta = (array) ($candidate->video_meta ?? []);
        $path = null;
        $videoMeta = null;

        if ($this->usesCloudinaryMedia()) {
            $realPath = $data['video']->getRealPath();

            if (!$realPath) {
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible d’accéder à la vidéo temporaire envoyée.',
                ], 422);
            }

            $upload = $this->cloudinaryMedia->uploadFile($realPath, [
                'resource_type' => 'video',
                'folder' => sprintf('candidates/videos/%d', $candidate->id),
                'public_id' => $this->buildCloudinaryPublicId('video', $candidate->id, $data['video']->getClientOriginalName()),
                'overwrite' => true,
                'invalidate' => true,
            ]);

            $path = $upload['url'];
            $videoMeta = [
                'storage' => 'cloudinary',
                'mime' => $data['video']->getMimeType(),
                'original_name' => $data['video']->getClientOriginalName(),
                'cloudinary' => $upload,
            ];
        } else {
            $uploadedPath = $data['video']->store('candidates/videos', 'public');
            $path = $this->compressVideo($uploadedPath) ?? $uploadedPath;

            if ($path !== $uploadedPath) {
                Storage::disk('public')->delete($uploadedPath);
            }

            $videoMeta = [
                'storage' => 'local',
                'mime' => $data['video']->getMimeType(),
                'original_name' => $data['video']->getClientOriginalName(),
            ];
        }

        try {
            $candidate->update([
                'video_path' => $path,
                'video_meta' => $videoMeta,
            ]);
        } catch (\Throwable $exception) {
            $this->deleteStoredVideo($path, (array) $videoMeta);
            throw $exception;
        }

        if ($previousVideoPath && $previousVideoPath !== $path) {
            $this->deleteStoredVideo($previousVideoPath, $previousVideoMeta);
        }

        return response()->json([
            'success' => true,
            'message' => 'Vidéo mise à jour',
            'candidate' => $candidate->fresh(),
            'video_path' => $candidate->video_path,
            'video_url' => MediaUrl::fromPath($candidate->video_path),
        ]);
    }

    public function toggleStatus(Candidate $candidate): JsonResponse
    {
        $this->authorize('update', $candidate);
        $data = request()->validate([
            'is_active' => ['required', 'boolean'],
        ]);
        $this->candidateAccounts->syncStatus($candidate, $data['is_active']);

        return response()->json([
            'success' => true,
            'message' => 'Statut du candidat mis à jour',
            'candidate' => $candidate->fresh(),
        ]);
    }

    // Alias for clarity if a route calls updateStatus
    public function updateStatus(Request $request, $id): JsonResponse
    {
        $candidate = Candidate::findOrFail($id);
        $this->authorize('update', $candidate);
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);
        $this->candidateAccounts->syncStatus($candidate, $validated['is_active']);

        return response()->json([
            'success' => true,
            'message' => 'Statut du candidat mis à jour',
            'candidate' => $candidate->fresh(),
        ]);
    }

    public function dashboard(): JsonResponse
    {
        $user = request()->user();
        $candidate = $user?->candidate()->with('category')->first();

        if (!$candidate) {
            return response()->json([
                'message' => 'Profil candidat introuvable.',
            ], 404);
        }

        $totalVotes = (int) $candidate->votes()
            ->where('status', 'confirmed')
            ->sum('quantity');

        $rankedCandidates = Candidate::query()
            ->select('candidates.id')
            ->withSum(['votes as votes_count' => function (Builder $query) {
                $query->where('status', 'confirmed');
            }], 'quantity')
            ->where('is_active', true)
            ->where(function (Builder $query) {
                $query->where('status', 'active')->orWhereNull('status');
            })
            ->orderByDesc('votes_count')
            ->orderBy('id')
            ->get();

        $rank = $rankedCandidates->search(fn ($row) => (int) $row->id === (int) $candidate->id);
        $totalCandidates = $rankedCandidates->count();

        $evolution = collect(range(6, 0))->map(function (int $daysAgo) use ($candidate) {
            $date = now()->subDays($daysAgo);

            return [
                'date' => $date->locale('fr')->translatedFormat('d M'),
                'votes' => (int) $candidate->votes()
                    ->where('status', 'confirmed')
                    ->whereDate('created_at', $date->toDateString())
                    ->sum('quantity'),
            ];
        })->values();

        $history = $candidate->votes()
            ->with('user:id,name,email')
            ->where('status', 'confirmed')
            ->latest()
            ->limit(12)
            ->get()
            ->map(function ($vote) {
                $email = $vote->user?->email;
                $maskedEmail = $email ? preg_replace('/(^.).*(@.*$)/', '$1***$2', $email) : 'Votant anonyme';

                return [
                    'id' => $vote->id,
                    'voter' => $maskedEmail,
                    'votes' => (int) $vote->quantity,
                    'amount' => (int) $vote->amount,
                    'date' => $vote->created_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json([
            'candidate' => [
                'id' => $candidate->id,
                'name' => trim($candidate->first_name . ' ' . $candidate->last_name),
                'category' => $candidate->category?->name ?? 'Candidat',
                'university' => $candidate->university,
                'public_number' => $candidate->public_number,
            ],
            'totalVotes' => $totalVotes,
            'rank' => $rank === false ? null : $rank + 1,
            'totalCandidates' => $totalCandidates,
            'evolution' => $evolution,
            'history' => $history,
        ]);
    }

    private function processPhotoSynchronously(Candidate $candidate, string $path): JsonResponse
    {
        try {
            $this->candidateImagePipeline->process($candidate->fresh(), $path);
        } catch (ValidationException $exception) {
            $freshCandidate = $candidate->fresh();
            if ($freshCandidate) {
                $message = $exception->errors()['photo'][0]
                    ?? collect($exception->errors())->flatten()->first()
                    ?? $exception->getMessage();

                $this->candidateImagePipeline->markFailed($freshCandidate, $message);
            }

            throw $exception;
        } catch (\Throwable $exception) {
            $freshCandidate = $candidate->fresh();
            if ($freshCandidate) {
                $this->candidateImagePipeline->markFailed($freshCandidate, $exception->getMessage());
            }

            report($exception);

            return response()->json([
                'success' => false,
                'message' => 'La photo a ete recue, mais son traitement a echoue. ' . $exception->getMessage(),
                'candidate' => $candidate->fresh(),
            ], 500);
        }

        $candidate->refresh();

        return response()->json([
            'success' => true,
            'processing' => false,
            'message' => 'Photo mise a jour avec succes.',
            'candidate' => $candidate,
            'photo_path' => $candidate->photo_path,
            'photo_url' => MediaUrl::fromPath($candidate->photo_path),
            'photo_urls' => $candidate->photo_urls,
        ]);
    }

    private function processTemporaryPhotoSynchronously(Candidate $candidate, string $absolutePath, ?string $originalFilename = null): JsonResponse
    {
        try {
            $this->candidateImagePipeline->processTemporaryUpload($candidate->fresh(), $absolutePath, $originalFilename);
        } catch (ValidationException $exception) {
            $freshCandidate = $candidate->fresh();
            if ($freshCandidate) {
                $message = $exception->errors()['photo'][0]
                    ?? collect($exception->errors())->flatten()->first()
                    ?? $exception->getMessage();

                $this->candidateImagePipeline->markFailed($freshCandidate, $message);
            }

            throw $exception;
        } catch (\Throwable $exception) {
            $freshCandidate = $candidate->fresh();
            if ($freshCandidate) {
                $this->candidateImagePipeline->markFailed($freshCandidate, $exception->getMessage());
            }

            report($exception);

            return response()->json([
                'success' => false,
                'message' => 'La photo a ete recue, mais son traitement a echoue. ' . $exception->getMessage(),
                'candidate' => $candidate->fresh(),
            ], 500);
        }

        $candidate->refresh();

        return response()->json([
            'success' => true,
            'processing' => false,
            'message' => 'Photo mise a jour avec succes.',
            'candidate' => $candidate,
            'photo_path' => $candidate->photo_path,
            'photo_url' => MediaUrl::fromPath($candidate->photo_path),
            'photo_urls' => $candidate->photo_urls,
        ]);
    }

    private function compressVideo(string $relativePath): ?string
    {
        if (!class_exists(\ProtoneMedia\LaravelFFMpeg\Support\FFMpeg::class)) {
            return $relativePath; // leave original
        }

        try {
            $filename = pathinfo($relativePath, PATHINFO_FILENAME);
            $ext = pathinfo($relativePath, PATHINFO_EXTENSION);
            $compressed = 'candidates/videos/' . $filename . '-compressed.' . $ext;

            \ProtoneMedia\LaravelFFMpeg\Support\FFMpeg::fromDisk('public')
                ->open($relativePath)
                ->export()
                ->toDisk('public')
                ->inFormat(new \FFMpeg\Format\Video\X264('aac'))
                ->save($compressed);

            return $compressed;
        } catch (\Throwable $e) {
            return $relativePath;
        }
    }

    private function deleteStoredVideo(?string $path, array $meta = []): void
    {
        if (!$path) {
            return;
        }

        if ($this->usesCloudinaryMedia()) {
            $asset = $meta['cloudinary'] ?? null;
            if (is_array($asset) && !empty($asset['public_id'])) {
                $this->cloudinaryMedia->destroy($asset);
                return;
            }
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return;
        }

        $normalizedPath = MediaUrl::toStorageRelativePath($path);
        if (!$normalizedPath) {
            return;
        }

        Storage::disk('public')->delete($normalizedPath);
    }

    private function invalidUploadResponse(?UploadedFile $file, string $field, string $label, ?string $appLimitLabel = null): ?JsonResponse
    {
        if (!$file || $file->isValid()) {
            return null;
        }

        $serverLimit = $this->iniLimit('upload_max_filesize');
        $limitHint = $appLimitLabel
            ? " La plateforme est configurée pour accepter jusqu’à {$appLimitLabel}."
            : '';
        $message = match ($file->getError()) {
            \UPLOAD_ERR_INI_SIZE => "{$label} dépasse la limite actuelle du serveur ({$serverLimit}).{$limitHint} Redémarrez PHP ou le serveur web après la mise à jour de la configuration puis réessayez.",
            \UPLOAD_ERR_FORM_SIZE => "{$label} dépasse la taille maximale autorisée par le formulaire.",
            \UPLOAD_ERR_PARTIAL => "{$label} n’a été envoyée que partiellement. Réessayez l’envoi.",
            \UPLOAD_ERR_NO_TMP_DIR => "Le serveur ne dispose pas d’un dossier temporaire valide pour recevoir {$label}.",
            \UPLOAD_ERR_CANT_WRITE => "Le serveur n’a pas pu écrire {$label} sur le disque.",
            \UPLOAD_ERR_EXTENSION => "{$label} a été bloquée par une extension PHP du serveur.",
            default => "{$label} n’a pas pu être envoyée correctement.",
        };

        return response()->json([
            'message' => $message,
            'errors' => [
                $field => [$message],
            ],
        ], 422);
    }

    private function iniLimit(string $key): string
    {
        return (string) (ini_get($key) ?: 'inconnue');
    }

    private function videoUploadMaxSizeMegabytes(): int
    {
        return max(1, (int) config('uploads.video.max_size_mb', 2048));
    }

    private function videoUploadMaxSizeKilobytes(): int
    {
        return $this->videoUploadMaxSizeMegabytes() * 1024;
    }

    private function videoUploadLimitLabel(): string
    {
        return $this->formatMegabytes($this->videoUploadMaxSizeMegabytes());
    }

    private function formatMegabytes(int $sizeInMegabytes): string
    {
        if ($sizeInMegabytes >= 1024) {
            $sizeInGigabytes = $sizeInMegabytes / 1024;
            $formattedGigabytes = fmod($sizeInGigabytes, 1.0) === 0.0
                ? (string) (int) $sizeInGigabytes
                : rtrim(rtrim(number_format($sizeInGigabytes, 1, '.', ''), '0'), '.');

            return "{$formattedGigabytes} Go";
        }

        return "{$sizeInMegabytes} Mo";
    }

    private function usesCloudinaryMedia(): bool
    {
        return $this->cloudinaryMedia->enabled();
    }

    private function buildCloudinaryPublicId(string $type, int $candidateId, ?string $filename = null): string
    {
        $basename = pathinfo((string) $filename, PATHINFO_FILENAME);
        $slug = Str::slug($basename);

        return trim(implode('-', array_filter([
            $type,
            (string) $candidateId,
            $slug ?: null,
            now()->format('YmdHis'),
            bin2hex(random_bytes(4)),
        ])), '-');
    }
}
