<?php

namespace App\Services\Media;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class CloudinaryMediaService
{
    public function enabled(): bool
    {
        return config('media.driver') === 'cloudinary'
            && (
                filled(config('media.cloudinary.url'))
                || (
                    filled(config('media.cloudinary.cloud_name'))
                    && filled(config('media.cloudinary.api_key'))
                    && filled(config('media.cloudinary.api_secret'))
                )
            );
    }

    public function uploadFile(string $absolutePath, array $options = []): array
    {
        if (!is_file($absolutePath)) {
            throw new RuntimeException("Fichier Cloudinary introuvable: {$absolutePath}");
        }

        $contents = @file_get_contents($absolutePath);
        if ($contents === false) {
            throw new RuntimeException("Impossible de lire le fichier pour Cloudinary: {$absolutePath}");
        }

        return $this->uploadBinary(
            $contents,
            basename($absolutePath),
            $options,
        );
    }

    public function uploadBinary(string $contents, string $filename, array $options = []): array
    {
        $credentials = $this->credentials();
        $resourceType = (string) ($options['resource_type'] ?? 'image');
        $endpoint = $this->endpoint($credentials['cloud_name'], $resourceType, 'upload');

        $payload = array_filter([
            'folder' => $this->folder($options['folder'] ?? null),
            'public_id' => $options['public_id'] ?? null,
            'overwrite' => isset($options['overwrite']) ? ($options['overwrite'] ? 'true' : 'false') : null,
            'invalidate' => isset($options['invalidate']) ? ($options['invalidate'] ? 'true' : 'false') : null,
            'use_filename' => isset($options['use_filename']) ? ($options['use_filename'] ? 'true' : 'false') : null,
            'unique_filename' => isset($options['unique_filename']) ? ($options['unique_filename'] ? 'true' : 'false') : null,
            'tags' => $this->normalizeTags($options['tags'] ?? []),
        ], static fn ($value) => $value !== null && $value !== '');

        $response = Http::withBasicAuth($credentials['api_key'], $credentials['api_secret'])
            ->timeout((int) config('media.cloudinary.timeout', 30))
            ->attach('file', $contents, $filename)
            ->post($endpoint, $payload);

        if (!$response->successful()) {
            throw new RuntimeException('Echec de l’upload Cloudinary: ' . $response->body());
        }

        $data = $response->json();

        return [
            'url' => $data['secure_url'] ?? $data['url'] ?? null,
            'public_id' => $data['public_id'] ?? null,
            'resource_type' => $data['resource_type'] ?? $resourceType,
            'asset_id' => $data['asset_id'] ?? null,
            'version' => $data['version'] ?? null,
            'format' => $data['format'] ?? null,
            'bytes' => $data['bytes'] ?? null,
            'width' => $data['width'] ?? null,
            'height' => $data['height'] ?? null,
            'duration' => $data['duration'] ?? null,
            'original_filename' => $data['original_filename'] ?? pathinfo($filename, PATHINFO_FILENAME),
        ];
    }

    public function destroy(?array $asset = null): void
    {
        if (!$this->enabled() || !is_array($asset)) {
            return;
        }

        $publicId = $asset['public_id'] ?? null;
        if (!$publicId) {
            return;
        }

        $credentials = $this->credentials();
        $resourceType = (string) ($asset['resource_type'] ?? 'image');
        $endpoint = $this->endpoint($credentials['cloud_name'], $resourceType, 'destroy');

        $response = Http::withBasicAuth($credentials['api_key'], $credentials['api_secret'])
            ->timeout((int) config('media.cloudinary.timeout', 30))
            ->asForm()
            ->post($endpoint, [
                'public_id' => $publicId,
                'invalidate' => 'true',
            ]);

        if (!$response->successful()) {
            throw new RuntimeException('Echec de la suppression Cloudinary: ' . $response->body());
        }
    }

    private function credentials(): array
    {
        $url = trim((string) config('media.cloudinary.url', ''));

        if ($url !== '') {
            $parts = parse_url($url);

            if (is_array($parts)) {
                $cloudName = trim((string) ($parts['host'] ?? ''), '<>');
                $apiKey = trim((string) ($parts['user'] ?? ''), '<>');
                $apiSecret = trim((string) ($parts['pass'] ?? ''), '<>');

                if ($cloudName !== '' && $apiKey !== '' && $apiSecret !== '') {
                    return [
                        'cloud_name' => $cloudName,
                        'api_key' => $apiKey,
                        'api_secret' => $apiSecret,
                    ];
                }
            }
        }

        $cloudName = trim((string) config('media.cloudinary.cloud_name', ''), '<>');
        $apiKey = trim((string) config('media.cloudinary.api_key', ''), '<>');
        $apiSecret = trim((string) config('media.cloudinary.api_secret', ''), '<>');

        if ($cloudName === '' || $apiKey === '' || $apiSecret === '') {
            throw new RuntimeException('Configuration Cloudinary incomplète.');
        }

        return [
            'cloud_name' => $cloudName,
            'api_key' => $apiKey,
            'api_secret' => $apiSecret,
        ];
    }

    private function folder(?string $folder = null): ?string
    {
        $baseFolder = trim((string) config('media.cloudinary.folder', 'missandmister'), '/');
        $suffix = trim((string) $folder, '/');

        if ($baseFolder === '' && $suffix === '') {
            return null;
        }

        return trim(implode('/', array_filter([$baseFolder, $suffix])), '/');
    }

    private function endpoint(string $cloudName, string $resourceType, string $action): string
    {
        return sprintf(
            'https://api.cloudinary.com/v1_1/%s/%s/%s',
            $cloudName,
            $resourceType,
            $action,
        );
    }

    private function normalizeTags(array|string $tags): ?string
    {
        if (is_string($tags)) {
            $tags = array_map('trim', explode(',', $tags));
        }

        $tags = array_values(array_filter(array_map(
            static fn ($tag) => trim((string) $tag),
            $tags,
        )));

        return $tags === [] ? null : implode(',', $tags);
    }
}
