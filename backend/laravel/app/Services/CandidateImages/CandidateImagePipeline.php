<?php

namespace App\Services\CandidateImages;

use App\Contracts\CandidateFaceDetector;
use App\Models\Candidate;
use App\Services\Media\CloudinaryMediaService;
use App\Support\CandidateFaceBox;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

class CandidateImagePipeline
{
    public function __construct(
        private readonly CandidateFaceDetector $faceDetector,
        private readonly CloudinaryMediaService $cloudinaryMedia,
    ) {
    }

    public function validateUpload(string $absolutePath): array
    {
        $imageInfo = $this->readImageInfo($absolutePath);
        $width = (int) $imageInfo[0];
        $height = (int) $imageInfo[1];

        if ($width < config('candidate_images.minimum_width')) {
            $this->fail('La photo doit faire au moins ' . config('candidate_images.minimum_width') . ' px de large.');
        }

        if ($height < config('candidate_images.minimum_height')) {
            $this->fail('La photo doit faire au moins ' . config('candidate_images.minimum_height') . ' px de haut.');
        }

        $blurScore = $this->measureSharpness($absolutePath);
        if ($blurScore < (float) config('candidate_images.blur_threshold')) {
            $this->fail('La photo est trop floue. Utilisez une image plus nette.');
        }

        $detection = $this->detectFaceResult($absolutePath);
        $face = $detection['face'];
        $faceDetectionError = $detection['error'];

        if (!$face && !$faceDetectionError && config('candidate_images.require_face_detection')) {
            $this->fail('Aucun visage detecte sur la photo.');
        }

        return [
            'source_width' => $width,
            'source_height' => $height,
            'mime' => $imageInfo['mime'] ?? null,
            'blur_score' => round($blurScore, 2),
            'face' => $face?->toArray(),
            'face_detection_error' => $faceDetectionError,
        ];
    }

    public function process(Candidate $candidate, string $expectedOriginalPath): void
    {
        if ($candidate->photo_original_path !== $expectedOriginalPath) {
            return;
        }

        $disk = config('candidate_images.disk', 'public');
        $storage = Storage::disk($disk);

        if (!$storage->exists($expectedOriginalPath)) {
            throw new \RuntimeException('Le fichier source de la photo est introuvable.');
        }

        $absolutePath = $storage->path($expectedOriginalPath);
        $meta = is_array($candidate->photo_meta) ? $candidate->photo_meta : [];
        $sourceInfo = $this->readImageInfo($absolutePath);
        $face = CandidateFaceBox::fromArray($meta['face'] ?? null);
        $faceDetectionError = $meta['face_detection_error'] ?? null;

        if (!$face) {
            $detection = $this->detectFaceResult($absolutePath);
            $face = $detection['face'];
            $faceDetectionError = $faceDetectionError ?: $detection['error'];
        }

        if (!$face && !$faceDetectionError && config('candidate_images.require_face_detection')) {
            throw ValidationException::withMessages([
                'photo' => 'Impossible de traiter la photo sans visage detecte.',
            ]);
        }

        $previousVariants = array_values(array_filter((array) ($candidate->photo_variants ?? [])));
        $variants = [];

        foreach ((array) config('candidate_images.sizes', []) as $name => $size) {
            $width = (int) ($size['width'] ?? 0);
            $height = (int) ($size['height'] ?? 0);

            if ($width < 1 || $height < 1) {
                continue;
            }

            $image = $this->createVariant($absolutePath, $width, $height, $face);
            $encodedVariant = $this->encodeVariant($image);
            $encoded = $encodedVariant['encoded'];
            $extension = $encodedVariant['extension'];

            $path = sprintf(
                'candidate-images/%d/%s/%s.%s',
                $candidate->id,
                $name,
                now()->format('YmdHis') . '-' . bin2hex(random_bytes(6)),
                $extension,
            );

            $storage->put($path, (string) $encoded);
            $variants[$name] = $path;
        }

        if (empty($variants)) {
            throw new \RuntimeException('Aucune variante d’image n’a ete generee.');
        }

        $candidate->forceFill([
            'photo_path' => $variants['large'] ?? end($variants),
            'photo_variants' => $variants,
            'photo_meta' => array_merge($meta, [
                'storage' => 'local',
                'source_width' => (int) $sourceInfo[0],
                'source_height' => (int) $sourceInfo[1],
                'processed_at' => now()->toIso8601String(),
                'face' => $face?->toArray(),
                'face_detection_error' => $faceDetectionError,
            ]),
            'photo_processing_status' => 'ready',
            'photo_processing_error' => null,
        ])->save();

        $stalePaths = array_diff($previousVariants, array_values($variants));
        if (!empty($stalePaths)) {
            $storage->delete($stalePaths);
        }
    }

    public function processTemporaryUpload(Candidate $candidate, string $absolutePath, ?string $originalFilename = null): void
    {
        if (!$this->cloudinaryMedia->enabled()) {
            throw new \RuntimeException('Le stockage Cloudinary n’est pas actif.');
        }

        $meta = is_array($candidate->photo_meta) ? $candidate->photo_meta : [];
        $sourceInfo = $this->readImageInfo($absolutePath);
        $face = CandidateFaceBox::fromArray($meta['face'] ?? null);
        $faceDetectionError = $meta['face_detection_error'] ?? null;

        if (!$face) {
            $detection = $this->detectFaceResult($absolutePath);
            $face = $detection['face'];
            $faceDetectionError = $faceDetectionError ?: $detection['error'];
        }

        if (!$face && !$faceDetectionError && config('candidate_images.require_face_detection')) {
            throw ValidationException::withMessages([
                'photo' => 'Impossible de traiter la photo sans visage detecte.',
            ]);
        }

        $previousMeta = $meta;
        $previousOriginalPath = $candidate->photo_original_path;
        $previousVariants = array_values(array_filter((array) ($candidate->photo_variants ?? [])));
        $uploads = [
            'original' => null,
            'variants' => [],
        ];
        $variantUrls = [];

        try {
            $uploads['original'] = $this->cloudinaryMedia->uploadFile($absolutePath, [
                'resource_type' => 'image',
                'folder' => sprintf('candidate-images/%d/originals', $candidate->id),
                'public_id' => $this->cloudinaryPublicId($candidate, $originalFilename, 'original'),
                'overwrite' => true,
                'invalidate' => true,
            ]);

            foreach ((array) config('candidate_images.sizes', []) as $name => $size) {
                $width = (int) ($size['width'] ?? 0);
                $height = (int) ($size['height'] ?? 0);

                if ($width < 1 || $height < 1) {
                    continue;
                }

                $image = $this->createVariant($absolutePath, $width, $height, $face);
                $encodedVariant = $this->encodeVariant($image);
                $upload = $this->cloudinaryMedia->uploadBinary(
                    (string) $encodedVariant['encoded'],
                    sprintf('%s.%s', $name, $encodedVariant['extension']),
                    [
                        'resource_type' => 'image',
                        'folder' => sprintf('candidate-images/%d/%s', $candidate->id, $name),
                        'public_id' => $this->cloudinaryPublicId($candidate, $originalFilename, $name),
                        'overwrite' => true,
                        'invalidate' => true,
                    ],
                );

                $uploads['variants'][$name] = $upload;
                $variantUrls[$name] = $upload['url'];
            }

            if (empty($variantUrls)) {
                throw new \RuntimeException('Aucune variante d’image n’a ete generee.');
            }

            $candidate->forceFill([
                'photo_path' => $variantUrls['large'] ?? end($variantUrls),
                'photo_original_path' => $uploads['original']['url'] ?? null,
                'photo_variants' => $variantUrls,
                'photo_meta' => array_merge($meta, [
                    'storage' => 'cloudinary',
                    'source_width' => (int) $sourceInfo[0],
                    'source_height' => (int) $sourceInfo[1],
                    'processed_at' => now()->toIso8601String(),
                    'face' => $face?->toArray(),
                    'face_detection_error' => $faceDetectionError,
                    'cloudinary' => [
                        'original' => $uploads['original'],
                        'variants' => $uploads['variants'],
                    ],
                ]),
                'photo_processing_status' => 'ready',
                'photo_processing_error' => null,
            ])->save();
        } catch (\Throwable $exception) {
            $this->destroyCloudinaryUploads($uploads);
            throw $exception;
        }

        $this->deleteCloudinaryPhotoAssets($previousMeta);
        $this->deleteLocalPhotoAssets(array_merge($previousVariants, [$previousOriginalPath]));
    }

    public function markFailed(Candidate $candidate, string $message): void
    {
        $candidate->forceFill([
            'photo_processing_status' => 'failed',
            'photo_processing_error' => mb_strimwidth($message, 0, 500, '...'),
        ])->save();
    }

    private function createVariant(
        string $absolutePath,
        int $targetWidth,
        int $targetHeight,
        ?CandidateFaceBox $face,
    ): \Intervention\Image\Interfaces\ImageInterface {
        $image = $this->manager()->decodePath($absolutePath)->orient();

        return $image
            ->brightness(8)
            ->contrast(10)
            ->sharpen(20)
            ->contain($targetWidth, $targetHeight, config('candidate_images.background_color', '#000000'), 'center');
    }

    private function encodeVariant(\Intervention\Image\Interfaces\ImageInterface $image): array
    {
        try {
            return [
                'encoded' => $image->encode(new WebpEncoder((int) config('candidate_images.webp_quality', 92))),
                'extension' => 'webp',
            ];
        } catch (\Throwable $webpException) {
            try {
                return [
                    'encoded' => $image->encode(new JpegEncoder((int) config('candidate_images.webp_quality', 92), progressive: true)),
                    'extension' => 'jpg',
                ];
            } catch (\Throwable $jpegException) {
                throw new \RuntimeException(
                    'Impossible d’encoder la photo au format WebP ou JPEG. '
                    . 'WebP: ' . $webpException->getMessage()
                    . ' | JPEG: ' . $jpegException->getMessage(),
                    previous: $jpegException,
                );
            }
        }
    }

    private function determineCropArea(
        int $sourceWidth,
        int $sourceHeight,
        int $targetWidth,
        int $targetHeight,
        ?CandidateFaceBox $face,
    ): array {
        $targetRatio = $targetWidth / $targetHeight;

        if (!$face) {
            return $this->centerCropArea($sourceWidth, $sourceHeight, $targetRatio);
        }

        $cropHeight = (int) round(max(
            $face->height * (float) config('candidate_images.face_crop_multiplier', 3.4),
            min($sourceHeight, $sourceWidth / $targetRatio)
        ));
        $cropHeight = min($cropHeight, $sourceHeight);
        $cropWidth = min($sourceWidth, (int) round($cropHeight * $targetRatio));

        if ($cropWidth < 1 || $cropHeight < 1) {
            return $this->centerCropArea($sourceWidth, $sourceHeight, $targetRatio);
        }

        $verticalAnchor = (float) config('candidate_images.face_frame_vertical_anchor', 0.38);
        $cropX = (int) round($face->centerX() - ($cropWidth / 2));
        $cropY = (int) round($face->centerY() - ($cropHeight * $verticalAnchor));

        $cropX = max(0, min($cropX, max(0, $sourceWidth - $cropWidth)));
        $cropY = max(0, min($cropY, max(0, $sourceHeight - $cropHeight)));

        return [$cropWidth, $cropHeight, $cropX, $cropY];
    }

    private function centerCropArea(int $sourceWidth, int $sourceHeight, float $targetRatio): array
    {
        $sourceRatio = $sourceWidth / $sourceHeight;

        if ($sourceRatio > $targetRatio) {
            $cropHeight = $sourceHeight;
            $cropWidth = (int) round($cropHeight * $targetRatio);
            $cropX = (int) round(($sourceWidth - $cropWidth) / 2);
            $cropY = 0;
        } else {
            $cropWidth = $sourceWidth;
            $cropHeight = (int) round($cropWidth / $targetRatio);
            $cropX = 0;
            $cropY = (int) round(($sourceHeight - $cropHeight) / 2);
        }

        return [$cropWidth, $cropHeight, $cropX, $cropY];
    }

    private function detectFaceResult(string $absolutePath): array
    {
        try {
            return [
                'face' => $this->faceDetector->detect($absolutePath),
                'error' => null,
            ];
        } catch (\Throwable $exception) {
            return [
                'face' => null,
                'error' => $exception->getMessage(),
            ];
        }
    }

    private function readImageInfo(string $absolutePath): array
    {
        $imageInfo = @getimagesize($absolutePath);
        if (!$imageInfo) {
            $this->fail('Le fichier envoye ne peut pas etre traite comme image.');
        }

        return $imageInfo;
    }

    private function measureSharpness(string $absolutePath): float
    {
        $binary = @file_get_contents($absolutePath);
        if ($binary === false) {
            return 0.0;
        }

        $resource = @imagecreatefromstring($binary);
        if (!$resource) {
            return 0.0;
        }

        $width = imagesx($resource);
        $height = imagesy($resource);
        $longestSide = max($width, $height);

        if ($longestSide > 320) {
            $ratio = 320 / $longestSide;
            $scaled = imagescale(
                $resource,
                max(1, (int) round($width * $ratio)),
                max(1, (int) round($height * $ratio)),
            );

            if ($scaled !== false) {
                imagedestroy($resource);
                $resource = $scaled;
                $width = imagesx($resource);
                $height = imagesy($resource);
            }
        }

        imagefilter($resource, IMG_FILTER_GRAYSCALE);
        imagefilter($resource, IMG_FILTER_EDGEDETECT);

        $samples = [];
        for ($y = 0; $y < $height; $y += 2) {
            for ($x = 0; $x < $width; $x += 2) {
                $rgb = imagecolorat($resource, $x, $y);
                $samples[] = $rgb & 0xFF;
            }
        }

        imagedestroy($resource);

        if ($samples === []) {
            return 0.0;
        }

        $mean = array_sum($samples) / count($samples);
        $variance = array_sum(array_map(
            static fn (int $value): float => ($value - $mean) ** 2,
            $samples,
        )) / count($samples);

        return sqrt($variance);
    }

    private function manager(): ImageManager
    {
        return new ImageManager(config('candidate_images.driver'));
    }

    private function deleteCloudinaryPhotoAssets(array $meta): void
    {
        $cloudinary = $meta['cloudinary'] ?? null;
        if (!is_array($cloudinary)) {
            return;
        }

        $this->cloudinaryMedia->destroy($cloudinary['original'] ?? null);

        foreach ((array) ($cloudinary['variants'] ?? []) as $asset) {
            $this->cloudinaryMedia->destroy(is_array($asset) ? $asset : null);
        }
    }

    private function destroyCloudinaryUploads(array $uploads): void
    {
        $this->cloudinaryMedia->destroy($uploads['original'] ?? null);

        foreach ((array) ($uploads['variants'] ?? []) as $asset) {
            $this->cloudinaryMedia->destroy(is_array($asset) ? $asset : null);
        }
    }

    private function deleteLocalPhotoAssets(array $paths): void
    {
        $normalizedPaths = collect($paths)
            ->filter()
            ->map(function (string $path): ?string {
                if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
                    return null;
                }

                if (str_starts_with($path, '/storage/')) {
                    return ltrim(substr($path, strlen('/storage/')), '/');
                }

                return ltrim($path, '/');
            })
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($normalizedPaths === []) {
            return;
        }

        Storage::disk(config('candidate_images.disk', 'public'))->delete($normalizedPaths);
    }

    private function cloudinaryPublicId(Candidate $candidate, ?string $filename, string $variant): string
    {
        $basename = pathinfo((string) $filename, PATHINFO_FILENAME);
        $slug = Str::slug($basename);

        return trim(implode('-', array_filter([
            'candidate',
            (string) $candidate->id,
            $variant,
            $slug ?: null,
            now()->format('YmdHis'),
            bin2hex(random_bytes(4)),
        ])), '-');
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages([
            'photo' => $message,
        ]);
    }
}
