<?php

return [
    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'up',
    ],

    'allowed_methods' => ['*'],

    /*
     * CORS origins are now configurable via env so it matches the URL you
     * actually use (localhost, LAN IP, production domain, etc.).
     * Examples:
     * CORS_ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.20:5173,https://app.example.com
     * CORS_ALLOWED_ORIGINS_PATTERN=https?://.*\\.example\\.com
     */
    // Default: allow common dev hosts plus the production frontend domain; override via env.
    'allowed_origins' => array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', implode(',', [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://missmisteruniversitybenin.com',
        'https://www.missmisteruniversitybenin.com',
    ]))))),

    // Keep patterns opt-in only; a raw fallback like .* can crash preg_match
    // on some shared-hosting setups depending on how the CORS package evaluates it.
    'allowed_origins_patterns' => array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS_PATTERN', '')))),

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
