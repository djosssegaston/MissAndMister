<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ClassementPdfExportService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ClassementExportController extends Controller
{
    public function __construct(
        private ClassementPdfExportService $classementExports,
    ) {
    }

    public function __invoke(): BinaryFileResponse|JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);

        $export = null;

        logger()->info('Classement PDF export controller entered', [
            'user_id' => request()->user()?->id,
            'route' => request()->path(),
        ]);

        try {
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
        } catch (\Throwable $exception) {
            $diagnostics = [];

            if (method_exists($this->classementExports, 'runtimeDiagnostics')) {
                try {
                    $diagnostics = $this->classementExports->runtimeDiagnostics();
                } catch (\Throwable) {
                    $diagnostics = [];
                }
            }

            logger()->error('Classement PDF export failed', [
                'message' => $exception->getMessage(),
                'exception' => get_class($exception),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'diagnostics' => $diagnostics,
            ]);

            report($exception);
            $this->classementExports->cleanupExportArtifacts($export['temp_directory'] ?? null);

            return response()->json([
                'message' => 'Impossible de générer le classement PDF pour le moment.',
            ], 500);
        }
    }

    public function testPdf(): BinaryFileResponse|JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);

        $export = null;
        $category = trim((string) request()->query('category', 'Miss'));

        logger()->info('Classement PDF isolated test controller entered', [
            'user_id' => request()->user()?->id,
            'route' => request()->path(),
            'category' => $category,
        ]);

        try {
            $export = $this->classementExports->createSingleCategoryPdf($category);

            app()->terminating(function () use ($export): void {
                $this->classementExports->cleanupExportArtifacts($export['temp_directory'] ?? null);
            });

            return response()->download(
                $export['pdf_path'],
                $export['download_name'],
                [
                    'Content-Type' => 'application/pdf',
                    'Cache-Control' => 'no-store, no-cache, must-revalidate',
                ]
            )->deleteFileAfterSend(true);
        } catch (\Throwable $exception) {
            $diagnostics = [];

            if (method_exists($this->classementExports, 'runtimeDiagnostics')) {
                try {
                    $diagnostics = $this->classementExports->runtimeDiagnostics();
                } catch (\Throwable) {
                    $diagnostics = [];
                }
            }

            logger()->error('Classement PDF isolated test failed', [
                'message' => $exception->getMessage(),
                'exception' => get_class($exception),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'category' => $category,
                'diagnostics' => $diagnostics,
            ]);

            report($exception);
            $this->classementExports->cleanupExportArtifacts($export['temp_directory'] ?? null);

            return response()->json([
                'message' => 'Impossible de générer le PDF de test pour le moment.',
            ], 500);
        }
    }
}
