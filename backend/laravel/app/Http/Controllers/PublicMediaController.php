<?php

namespace App\Http\Controllers;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class PublicMediaController extends Controller
{
    public function show(Request $request, string $path): Response
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

        try {
            $lastModified = $disk->lastModified($relativePath);
        } catch (Throwable) {
            $lastModified = null;
        }

        $filename = basename($relativePath);
        $etag = '"' . sha1(implode('|', [$relativePath, $size ?? 'na', $lastModified ?? 'na'])) . '"';
        $lastModifiedHeader = $lastModified ? gmdate('D, d M Y H:i:s', $lastModified) . ' GMT' : null;

        if ($request->headers->get('if-none-match') === $etag) {
            return response('', 304, array_filter([
                'ETag' => $etag,
                'Last-Modified' => $lastModifiedHeader,
                'Cache-Control' => 'public, max-age=31536000, immutable',
            ]));
        }

        if ($lastModifiedHeader && $request->headers->get('if-modified-since') === $lastModifiedHeader) {
            return response('', 304, array_filter([
                'ETag' => $etag,
                'Last-Modified' => $lastModifiedHeader,
                'Cache-Control' => 'public, max-age=31536000, immutable',
            ]));
        }

        $stream = $disk->readStream($relativePath);

        abort_unless(is_resource($stream), 404, 'Media not found.');

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, array_filter([
            'Content-Type' => $mimeType,
            'Content-Length' => $size,
            'Content-Disposition' => (new ResponseHeaderBag())->makeDisposition('inline', $filename),
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'ETag' => $etag,
            'Last-Modified' => $lastModifiedHeader,
        ]));
    }
}
