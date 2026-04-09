<?php

use Intervention\Image\Drivers\Gd\Driver;

return [
    'disk' => env('CANDIDATE_IMAGE_DISK', 'public'),
    'queue' => env('CANDIDATE_IMAGE_QUEUE', 'images'),
    'async_processing' => filter_var(env('CANDIDATE_IMAGE_ASYNC_PROCESSING', false), FILTER_VALIDATE_BOOL),
    'driver' => env('CANDIDATE_IMAGE_DRIVER', Driver::class),

    'background_color' => env('CANDIDATE_IMAGE_BACKGROUND_COLOR', '#000000'),
    'webp_quality' => (int) env('CANDIDATE_IMAGE_WEBP_QUALITY', 92),

    'minimum_width' => (int) env('CANDIDATE_IMAGE_MIN_WIDTH', 500),
    'minimum_height' => (int) env('CANDIDATE_IMAGE_MIN_HEIGHT', 500),
    'blur_threshold' => (float) env('CANDIDATE_IMAGE_BLUR_THRESHOLD', 15),

    // Face detection improves framing but should not block uploads in local environments by default.
    'face_detection_provider' => env('CANDIDATE_IMAGE_FACE_PROVIDER', 'none'),
    'require_face_detection' => filter_var(env('CANDIDATE_IMAGE_REQUIRE_FACE', false), FILTER_VALIDATE_BOOL),

    'face_frame_vertical_anchor' => (float) env('CANDIDATE_IMAGE_FACE_VERTICAL_ANCHOR', 0.38),
    'face_crop_multiplier' => (float) env('CANDIDATE_IMAGE_FACE_CROP_MULTIPLIER', 3.4),

    'sizes' => [
        'thumbnail' => ['width' => 480, 'height' => 600],
        'medium' => ['width' => 800, 'height' => 1000],
        'large' => ['width' => 1400, 'height' => 1750],
    ],
];
