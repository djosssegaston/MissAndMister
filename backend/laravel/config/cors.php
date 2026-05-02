<?php

$defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://missmisteruniversitybenin.com',
    'https://www.missmisteruniversitybenin.com',
];

$defaultAllowedOriginPatterns = [
    '#^https://.*\.vercel\.app$#',
];

$parseCorsList = static function (string $key, array $fallback): array {
    $raw = env($key);

    if (is_array($raw)) {
        $normalized = array_values(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            $raw,
        ), static fn (string $value) => $value !== ''));

        return $normalized !== [] ? $normalized : $fallback;
    }

    $normalized = array_values(array_filter(array_map(
        'trim',
        explode(',', (string) $raw),
    ), static fn (string $value) => $value !== ''));

    return $normalized !== [] ? $normalized : $fallback;
};

return [
    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'up',
    ],

    'allowed_methods' => ['*'],

    /*
     * Keep the production frontend domain always allowed by default and only
     * let environment variables extend or replace the list when they contain
     * real values. This avoids blank env overrides wiping Vercel preview CORS.
     */
    'allowed_origins' => $parseCorsList('CORS_ALLOWED_ORIGINS', $defaultAllowedOrigins),

    /*
     * Vercel preview URLs need direct API access when the same-origin proxy is
     * unavailable or returns a protected/error page. An empty env value should
     * not disable this fallback pattern.
     */
    'allowed_origins_patterns' => $parseCorsList('CORS_ALLOWED_ORIGINS_PATTERN', $defaultAllowedOriginPatterns),

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
