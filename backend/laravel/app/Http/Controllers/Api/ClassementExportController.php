<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ClassementPdfExportService;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ClassementExportController extends Controller
{
    public function __construct(
        private ClassementPdfExportService $classementExports,
    ) {
    }

    public function __invoke(): BinaryFileResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);

        $export = $this->classementExports->createClassementZip();

        app()->terminating(function () use ($export): void {
            $this->classementExports->cleanupExportArtifacts($export['temp_directory'] ?? null);
        });

        return response()->download(
            $export['zip_path'],
            $export['download_name'],
            [
                'Content-Type' => 'application/zip',
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
            ]
        )->deleteFileAfterSend(true);
    }
}
