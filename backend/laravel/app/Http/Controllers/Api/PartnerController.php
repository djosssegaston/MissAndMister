<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PartnerLogo;
use App\Services\Media\CloudinaryMediaService;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PartnerController extends Controller
{
    private const LOGO_UPLOAD_LIMIT_LABEL = '20 Mo';

    public function __construct(
        private CloudinaryMediaService $cloudinaryMedia,
    ) {
    }

    public function publicIndex(): JsonResponse
    {
        $items = PartnerLogo::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $items->map(fn (PartnerLogo $item) => $this->serialize($item))->values(),
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        $items = PartnerLogo::query()
            ->orderByDesc('is_active')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $items->map(fn (PartnerLogo $item) => $this->serialize($item))->values(),
            'stats' => [
                'total' => $items->count(),
                'active' => $items->where('is_active', true)->count(),
                'inactive' => $items->where('is_active', false)->count(),
                'with_websites' => $items->whereNotNull('website_url')->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($invalidUpload = $this->invalidUploadResponse($request->file('logo'), 'logo', 'Le logo')) {
            return $invalidUpload;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'website_url' => ['nullable', 'url', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ], [
            'name.required' => 'Le nom du partenaire est requis.',
            'website_url.url' => 'Le lien du site web est invalide.',
            'sort_order.integer' => 'L’ordre d’affichage doit être un nombre.',
            'sort_order.min' => 'L’ordre d’affichage doit être positif.',
            'is_active.boolean' => 'Le statut est invalide.',
            'logo.required' => 'Veuillez sélectionner un logo.',
            'logo.image' => 'Le fichier choisi doit être une image valide.',
            'logo.mimes' => 'Le logo doit être au format JPG, JPEG, PNG ou WebP.',
            'logo.max' => 'Le logo ne doit pas dépasser 20 Mo.',
            'logo.uploaded' => 'Le serveur a refusé l’envoi du logo. Vérifiez la taille du fichier puis réessayez.',
        ]);

        [$path, $meta] = $this->storeLogo($data['logo']);
        $isActive = $request->has('is_active') ? $request->boolean('is_active') : true;

        $partner = PartnerLogo::create([
            'name' => trim($data['name']),
            'website_url' => trim((string) ($data['website_url'] ?? '')) ?: null,
            'logo_path' => $path,
            'logo_meta' => $meta,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_active' => $isActive,
            'published_at' => $isActive ? now() : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Logo partenaire ajouté avec succès.',
            'partner' => $this->serialize($partner->fresh()),
        ], 201);
    }

    public function update(Request $request, PartnerLogo $partnerLogo): JsonResponse
    {
        if ($invalidUpload = $this->invalidUploadResponse($request->file('logo'), 'logo', 'Le logo')) {
            return $invalidUpload;
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'website_url' => ['nullable', 'url', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
            'logo' => ['sometimes', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ], [
            'name.required' => 'Le nom du partenaire est requis.',
            'website_url.url' => 'Le lien du site web est invalide.',
            'sort_order.integer' => 'L’ordre d’affichage doit être un nombre.',
            'sort_order.min' => 'L’ordre d’affichage doit être positif.',
            'is_active.boolean' => 'Le statut est invalide.',
            'logo.image' => 'Le fichier choisi doit être une image valide.',
            'logo.mimes' => 'Le logo doit être au format JPG, JPEG, PNG ou WebP.',
            'logo.max' => 'Le logo ne doit pas dépasser 20 Mo.',
            'logo.uploaded' => 'Le serveur a refusé l’envoi du logo. Vérifiez la taille du fichier puis réessayez.',
        ]);

        $previousPath = null;
        $previousMeta = [];

        if (!empty($data['logo'])) {
            [$path, $meta] = $this->storeLogo($data['logo']);
            $previousPath = $partnerLogo->logo_path;
            $previousMeta = (array) ($partnerLogo->logo_meta ?? []);
            $partnerLogo->logo_path = $path;
            $partnerLogo->logo_meta = $meta;
        }

        if (array_key_exists('name', $data)) {
            $partnerLogo->name = trim($data['name']);
        }

        if (array_key_exists('website_url', $data)) {
            $partnerLogo->website_url = trim((string) $data['website_url']) ?: null;
        }

        if (array_key_exists('sort_order', $data)) {
            $partnerLogo->sort_order = (int) $data['sort_order'];
        }

        if ($request->has('is_active')) {
            $partnerLogo->is_active = $request->boolean('is_active');
            $partnerLogo->published_at = $partnerLogo->is_active
                ? ($partnerLogo->published_at ?? now())
                : null;
        }

        $partnerLogo->save();

        if ($previousPath && $previousPath !== $partnerLogo->logo_path) {
            $this->deleteLogo($previousPath, $previousMeta);
        }

        return response()->json([
            'success' => true,
            'message' => 'Logo partenaire mis à jour avec succès.',
            'partner' => $this->serialize($partnerLogo->fresh()),
        ]);
    }

    public function destroy(PartnerLogo $partnerLogo): JsonResponse
    {
        abort_unless((request()->user()?->role ?? null) === 'superadmin', 403);
        $this->deleteLogo($partnerLogo->logo_path, (array) ($partnerLogo->logo_meta ?? []));
        $partnerLogo->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logo partenaire supprimé avec succès.',
        ]);
    }

    private function storeLogo(UploadedFile $logo): array
    {
        if ($this->cloudinaryMedia->enabled()) {
            $realPath = $logo->getRealPath();

            if (!$realPath) {
                throw new \RuntimeException('Impossible d’accéder au fichier logo temporaire.');
            }

            [$width, $height] = array_pad((array) @getimagesize($realPath), 2, null);
            $upload = $this->cloudinaryMedia->uploadFile($realPath, [
                'resource_type' => 'image',
                'folder' => 'partners/logos',
                'public_id' => $this->buildCloudinaryPublicId($logo->getClientOriginalName()),
                'overwrite' => true,
                'invalidate' => true,
            ]);

            return [$upload['url'], [
                'storage' => 'cloudinary',
                'width' => $upload['width'] ?? $width,
                'height' => $upload['height'] ?? $height,
                'size' => $upload['bytes'] ?? $logo->getSize(),
                'mime' => $logo->getMimeType(),
                'original_name' => $logo->getClientOriginalName(),
                'cloudinary' => $upload,
            ]];
        }

        $path = $logo->store('partners/logos', 'public');
        $absolutePath = Storage::disk('public')->path($path);
        [$width, $height] = array_pad((array) @getimagesize($absolutePath), 2, null);

        return [$path, [
            'storage' => 'local',
            'width' => $width,
            'height' => $height,
            'size' => $logo->getSize(),
            'mime' => $logo->getMimeType(),
            'original_name' => $logo->getClientOriginalName(),
        ]];
    }

    private function deleteLogo(?string $path, array $meta = []): void
    {
        if (!$path) {
            return;
        }

        if (($meta['storage'] ?? null) === 'cloudinary') {
            $cloudinary = $meta['cloudinary'] ?? null;
            if (is_array($cloudinary)) {
                $this->cloudinaryMedia->destroy($cloudinary);
            }
            return;
        }

        $storagePath = MediaUrl::toStorageRelativePath($path);
        if ($storagePath !== null) {
            Storage::disk('public')->delete($storagePath);
        }
    }

    private function buildCloudinaryPublicId(string $originalName): string
    {
        $base = Str::slug(pathinfo($originalName, PATHINFO_FILENAME) ?: 'partner-logo', '-');
        $base = $base !== '' ? $base : 'partner-logo';

        return $base . '-' . Str::lower(Str::random(8));
    }

    private function serialize(PartnerLogo $partner): array
    {
        return [
            'id' => $partner->id,
            'name' => $partner->name,
            'website_url' => $partner->website_url,
            'logo_path' => $partner->logo_path,
            'logo_url' => $partner->logo_url,
            'logo_meta' => $partner->logo_meta,
            'sort_order' => (int) $partner->sort_order,
            'is_active' => (bool) $partner->is_active,
            'published_at' => $partner->published_at?->toIso8601String(),
            'created_at' => $partner->created_at?->toIso8601String(),
            'updated_at' => $partner->updated_at?->toIso8601String(),
        ];
    }

    private function invalidUploadResponse(?UploadedFile $file, string $field, string $label): ?JsonResponse
    {
        if (!$file || $file->isValid()) {
            return null;
        }

        $serverLimit = $this->iniLimit('upload_max_filesize');
        $message = match ($file->getError()) {
            \UPLOAD_ERR_INI_SIZE => "{$label} dépasse la limite actuelle du serveur ({$serverLimit}). Redémarrez PHP après la mise à jour de la configuration d’upload puis réessayez.",
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
}
