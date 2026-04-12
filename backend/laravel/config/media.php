<?php

return [
    'driver' => env('MEDIA_DRIVER', 'local'),

    'cloudinary' => [
        'url' => env('CLOUDINARY_URL'),
        'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
        'api_key' => env('CLOUDINARY_API_KEY'),
        'api_secret' => env('CLOUDINARY_API_SECRET'),
        'folder' => env('CLOUDINARY_FOLDER', 'missandmister'),
        'timeout' => (int) env('CLOUDINARY_TIMEOUT', 30),
    ],
];
