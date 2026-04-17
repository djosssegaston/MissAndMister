<?php

namespace App\Http\Controllers;

use App\Support\MediaUrl;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicMediaController extends Controller
{
    public function show(string $path): StreamedResponse
    {
        $relativePath = MediaUrl::toStorageRelativePath($path);

        abort_if(
            $relativePath === null || str_contains($relativePath, '..'),
            404,
            'Media not found.'
        );

        $disk = Storage::disk(config('candidate_images.disk', 'public'));

        abort_unless($disk->exists($relativePath), 404, 'Media not found.');

        return $disk->response($relativePath);
    }
}
