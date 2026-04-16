<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GalleryItem;
use App\Services\Media\CloudinaryMediaService;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GalleryController extends Controller
{
    private const DEFAULT_CATEGORIES = ['Cérémonie', 'Candidats', 'Coulisses', 'Gala'];

    private const DEFAULT_SPANS = ['standard', 'wide', 'tall'];

    public function __construct(
        private CloudinaryMediaService $cloudinaryMedia,
    ) {
    }

    public function publicIndex(Request $request): JsonResponse
    {
        $items = GalleryItem::query()
            ->where('is_published', true)
            ->when($request->filled('category'), fn ($query) => $query->where('category', (string) $request->string('category')))
            ->when($request->filled('year'), function ($query) use ($request) {
                $year = (int) $request->query('year');

                if ($year > 0) {
                    $query->where(function ($nested) use ($year) {
                        $nested->whereYear('published_at', $year)
                            ->orWhere(function ($fallback) use ($year) {
                                $fallback->whereNull('published_at')->whereYear('created_at', $year);
                            });
                    });
                }
            })
            ->orderBy('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $items->map(fn (GalleryItem $item) => $this->serialize($item))->values(),
            'categories' => $this->availableCategories(true),
            'spans' => self::DEFAULT_SPANS,
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        $items = GalleryItem::query()
            ->orderByDesc('is_published')
            ->orderBy('sort_order')
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $items->map(fn (GalleryItem $item) => $this->serialize($item))->values(),
            'categories' => $this->availableCategories(),
            'spans' => self::DEFAULT_SPANS,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($invalidUpload = $this->invalidUploadResponse($request->file('image'), 'image', 'L’image')) {
            return $invalidUpload;
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:80'],
            'alt_text' => ['nullable', 'string', 'max:180'],
            'caption' => ['nullable', 'string', 'max:1000'],
            'layout_span' => ['nullable', Rule::in(self::DEFAULT_SPANS)],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_published' => ['nullable', 'boolean'],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ], [
            'title.required' => 'Le titre est requis.',
            'category.required' => 'La catégorie est requise.',
            'layout_span.in' => 'Le format de carte choisi est invalide.',
            'sort_order.integer' => 'L’ordre d’affichage doit être un nombre.',
            'sort_order.min' => 'L’ordre d’affichage doit être positif.',
            'is_published.boolean' => 'Le statut de publication est invalide.',
            'image.required' => 'Veuillez sélectionner une photo.',
            'image.image' => 'Le fichier choisi doit être une image valide.',
            'image.mimes' => 'La photo doit être au format JPG, JPEG, PNG ou WebP.',
            'image.max' => 'La photo ne doit pas dépasser 20 Mo.',
            'image.uploaded' => 'Le serveur a refusé l’envoi de l’image. Vérifiez la taille du fichier puis réessayez.',
        ]);

        [$path, $meta] = $this->storeImage($data['image']);
        $isPublished = $request->has('is_published') ? $request->boolean('is_published') : true;

        $item = GalleryItem::create([
            'title' => trim($data['title']),
            'category' => trim($data['category']),
            'alt_text' => trim((string) ($data['alt_text'] ?? '')) ?: trim($data['title']),
            'caption' => trim((string) ($data['caption'] ?? '')) ?: null,
            'image_path' => $path,
            'image_meta' => $meta,
            'layout_span' => $data['layout_span'] ?? 'standard',
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_published' => $isPublished,
            'published_at' => $isPublished ? now() : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Photo de galerie ajoutée avec succès.',
            'item' => $this->serialize($item->fresh()),
        ], 201);
    }

    public function update(Request $request, GalleryItem $galleryItem): JsonResponse
    {
        if ($invalidUpload = $this->invalidUploadResponse($request->file('image'), 'image', 'L’image')) {
            return $invalidUpload;
        }

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:160'],
            'category' => ['sometimes', 'required', 'string', 'max:80'],
            'alt_text' => ['nullable', 'string', 'max:180'],
            'caption' => ['nullable', 'string', 'max:1000'],
            'layout_span' => ['nullable', Rule::in(self::DEFAULT_SPANS)],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_published' => ['nullable', 'boolean'],
            'image' => ['sometimes', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ], [
            'title.required' => 'Le titre est requis.',
            'category.required' => 'La catégorie est requise.',
            'layout_span.in' => 'Le format de carte choisi est invalide.',
            'sort_order.integer' => 'L’ordre d’affichage doit être un nombre.',
            'sort_order.min' => 'L’ordre d’affichage doit être positif.',
            'is_published.boolean' => 'Le statut de publication est invalide.',
            'image.image' => 'Le fichier choisi doit être une image valide.',
            'image.mimes' => 'La photo doit être au format JPG, JPEG, PNG ou WebP.',
            'image.max' => 'La photo ne doit pas dépasser 20 Mo.',
            'image.uploaded' => 'Le serveur a refusé l’envoi de l’image. Vérifiez la taille du fichier puis réessayez.',
        ]);

        $previousPath = null;
        $previousMeta = [];

        if (!empty($data['image'])) {
            [$path, $meta] = $this->storeImage($data['image']);
            $previousPath = $galleryItem->image_path;
            $previousMeta = (array) ($galleryItem->image_meta ?? []);
            $galleryItem->image_path = $path;
            $galleryItem->image_meta = $meta;
        }

        if (array_key_exists('title', $data)) {
            $galleryItem->title = trim($data['title']);
            if (!$request->filled('alt_text')) {
                $galleryItem->alt_text = trim($galleryItem->title);
            }
        }

        if (array_key_exists('category', $data)) {
            $galleryItem->category = trim($data['category']);
        }

        if (array_key_exists('alt_text', $data)) {
            $galleryItem->alt_text = trim((string) $data['alt_text']) ?: trim($galleryItem->title);
        }

        if (array_key_exists('caption', $data)) {
            $galleryItem->caption = trim((string) $data['caption']) ?: null;
        }

        if (array_key_exists('layout_span', $data)) {
            $galleryItem->layout_span = $data['layout_span'] ?: 'standard';
        }

        if (array_key_exists('sort_order', $data)) {
            $galleryItem->sort_order = (int) $data['sort_order'];
        }

        if ($request->has('is_published')) {
            $galleryItem->is_published = $request->boolean('is_published');
            $galleryItem->published_at = $galleryItem->is_published
                ? ($galleryItem->published_at ?? now())
                : null;
        }

        $galleryItem->save();

        if ($previousPath && $previousPath !== $galleryItem->image_path) {
            $this->deleteImage($previousPath, $previousMeta);
        }

        return response()->json([
            'success' => true,
            'message' => 'Photo de galerie mise à jour avec succès.',
            'item' => $this->serialize($galleryItem->fresh()),
        ]);
    }

    public function destroy(GalleryItem $galleryItem): JsonResponse
    {
        abort_unless((request()->user()?->role ?? null) === 'superadmin', 403);
        $this->deleteImage($galleryItem->image_path, (array) ($galleryItem->image_meta ?? []));
        $galleryItem->delete();

        return response()->json([
            'success' => true,
            'message' => 'Photo de galerie supprimée avec succès.',
        ]);
    }

    private function storeImage(UploadedFile $image): array
    {
        if ($this->cloudinaryMedia->enabled()) {
            $realPath = $image->getRealPath();

            if (!$realPath) {
                throw new \RuntimeException('Impossible d’accéder au fichier image temporaire.');
            }

            [$width, $height] = array_pad((array) @getimagesize($realPath), 2, null);
            $upload = $this->cloudinaryMedia->uploadFile($realPath, [
                'resource_type' => 'image',
                'folder' => 'gallery/photos',
                'public_id' => $this->buildCloudinaryPublicId($image->getClientOriginalName()),
                'overwrite' => true,
                'invalidate' => true,
            ]);

            return [$upload['url'], [
                'storage' => 'cloudinary',
                'width' => $upload['width'] ?? $width,
                'height' => $upload['height'] ?? $height,
                'size' => $upload['bytes'] ?? $image->getSize(),
                'mime' => $image->getMimeType(),
                'original_name' => $image->getClientOriginalName(),
                'cloudinary' => $upload,
            ]];
        }

        $path = $image->store('gallery/photos', 'public');
        $absolutePath = Storage::disk('public')->path($path);
        [$width, $height] = array_pad((array) @getimagesize($absolutePath), 2, null);

        return [$path, [
            'storage' => 'local',
            'width' => $width,
            'height' => $height,
            'size' => $image->getSize(),
            'mime' => $image->getMimeType(),
            'original_name' => $image->getClientOriginalName(),
        ]];
    }

    private function deleteImage(?string $path, array $meta = []): void
    {
        if (!$path) {
            return;
        }

        if ($this->cloudinaryMedia->enabled()) {
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

    private function buildCloudinaryPublicId(?string $filename = null): string
    {
        $basename = pathinfo((string) $filename, PATHINFO_FILENAME);
        $slug = Str::slug($basename);

        return trim(implode('-', array_filter([
            now()->format('YmdHis'),
            $slug ?: 'gallery',
            bin2hex(random_bytes(4)),
        ])), '-');
    }

    private function availableCategories(bool $publishedOnly = false): array
    {
        $query = GalleryItem::query();

        if ($publishedOnly) {
            $query->where('is_published', true);
        }

        $stored = $query
            ->whereNotNull('category')
            ->pluck('category')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $orderedDefaults = array_values(array_filter(self::DEFAULT_CATEGORIES, fn (string $category) => in_array($category, $stored, true)));
        $remaining = array_values(array_diff($stored, self::DEFAULT_CATEGORIES));
        sort($remaining);

        return array_values(array_unique([...self::DEFAULT_CATEGORIES, ...$orderedDefaults, ...$remaining]));
    }

    private function serialize(GalleryItem $item): array
    {
        return [
            'id' => $item->id,
            'title' => $item->title,
            'caption' => $item->caption,
            'category' => $item->category,
            'alt_text' => $item->alt_text,
            'image_path' => $item->image_path,
            'image_url' => $item->image_url,
            'image_meta' => $item->image_meta,
            'layout_span' => $item->layout_span ?: 'standard',
            'sort_order' => (int) $item->sort_order,
            'is_published' => (bool) $item->is_published,
            'published_at' => $item->published_at?->toIso8601String(),
            'created_at' => $item->created_at?->toIso8601String(),
            'updated_at' => $item->updated_at?->toIso8601String(),
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
