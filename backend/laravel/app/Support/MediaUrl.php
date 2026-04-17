<?php

namespace App\Support;

class MediaUrl
{
    public static function fromPath(?string $path): ?string
    {
        $trimmed = self::normalizePath($path);
        if ($trimmed === null) {
            return null;
        }

        if (preg_match('/^(https?:|data:|blob:)/i', $trimmed)) {
            return $trimmed;
        }

        $storagePath = self::toStorageRelativePath($trimmed);
        if ($storagePath === null) {
            return null;
        }

        return url(self::publicPath($storagePath));
    }

    public static function publicPath(string $storagePath): string
    {
        return '/api/public/media/' . ltrim($storagePath, '/');
    }

    public static function toStorageRelativePath(?string $path): ?string
    {
        $trimmed = self::normalizePath($path);
        if ($trimmed === null) {
            return null;
        }

        if (preg_match('/^(https?:|data:|blob:)/i', $trimmed)) {
            $path = parse_url($trimmed, PHP_URL_PATH);

            if (! is_string($path) || $path === '') {
                return null;
            }

            $trimmed = $path;
        }

        $normalized = ltrim($trimmed, '/');

        foreach ([
            'api/public/media/' => '',
            'public/storage/' => 'storage/',
            'storage/app/public/' => 'storage/',
        ] as $prefix => $replacement) {
            if (str_starts_with($normalized, $prefix)) {
                $normalized = $replacement . substr($normalized, strlen($prefix));
                break;
            }
        }

        if (str_starts_with($normalized, 'storage/')) {
            $normalized = substr($normalized, strlen('storage/'));
        }

        return ltrim($normalized, '/');
    }

    private static function normalizePath(?string $path): ?string
    {
        if ($path === null) {
            return null;
        }

        $trimmed = trim($path);

        return $trimmed === '' ? null : $trimmed;
    }
}
