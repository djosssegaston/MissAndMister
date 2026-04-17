<?php

namespace App\Http\Controllers;

use App\Support\MediaUrl;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

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

        try {
            $mimeType = $disk->mimeType($relativePath) ?: 'application/octet-stream';
        } catch (Throwable) {
            $mimeType = 'application/octet-stream';
        }

        try {
            $size = $disk->size($relativePath);
        } catch (Throwable) {
            $size = null;
        }

        $filename = basename($relativePath);
        $stream = $disk->readStream($relativePath);

        abort_unless(is_resource($stream), 404, 'Media not found.');

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, array_filter([
            'Content-Type' => $mimeType,
            'Content-Length' => $size,
            'Content-Disposition' => (new ResponseHeaderBag())->makeDisposition('inline', $filename),
            'Cache-Control' => 'public, max-age=86400',
        ]));
    }
}
