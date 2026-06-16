<?php

$useLocalFallbacks = env('APP_ENV', 'production') === 'local';

return [
    'accounts' => [
        [
            'name' => env('PROD_ADMIN_NAME', $useLocalFallbacks ? 'Super Admin' : ''),
            'email' => env('PROD_ADMIN_EMAIL', $useLocalFallbacks ? 'admin@missandmister.test' : ''),
            'phone' => env('PROD_ADMIN_PHONE', $useLocalFallbacks ? '0000000000' : ''),
            'password' => env('PROD_ADMIN_PASSWORD', $useLocalFallbacks ? 'admin1234' : ''),
            'role' => env('PROD_ADMIN_ROLE', 'superadmin'),
            'status' => env('PROD_ADMIN_STATUS', 'active'),
        ],
        [
            'name' => env('STAFF_ADMIN_NAME', $useLocalFallbacks ? 'Administrateur MMUB' : ''),
            'email' => env('STAFF_ADMIN_EMAIL', $useLocalFallbacks ? 'missmisteruniversitybenin@gmail.com' : ''),
            'phone' => env('STAFF_ADMIN_PHONE', $useLocalFallbacks ? '+22955748787' : ''),
            'password' => env('STAFF_ADMIN_PASSWORD', $useLocalFallbacks ? 'AdminMmub2026!' : ''),
            'role' => env('STAFF_ADMIN_ROLE', 'admin'),
            'status' => env('STAFF_ADMIN_STATUS', 'active'),
        ],
    ],
];
