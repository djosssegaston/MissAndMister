<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ClassementPdfExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ClassementExportController extends Controller
{
    public function __construct(
        private ClassementPdfExportService $classementExports,
    ) {
    }

    public function __invoke(Request $request): BinaryFileResponse|JsonResponse
    {
        $export = null;

        logger()->info('Classement PDF export controller entered', [
            'route' => $request->path(),
            ...$this->buildAuthLogContext($request),
        ]);

        if ($authFailure = $this->ensureAdminAccess($request)) {
            return $authFailure;
        }

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

    public function testPdf(Request $request): BinaryFileResponse|JsonResponse
    {
        $export = null;
        $category = trim((string) $request->query('category', 'Miss'));

        logger()->info('Classement PDF isolated test controller entered', [
            'route' => $request->path(),
            'category' => $category,
            ...$this->buildAuthLogContext($request),
        ]);

        if ($authFailure = $this->ensureAdminAccess($request)) {
            return $authFailure;
        }

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

    private function ensureAdminAccess(Request $request): ?JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            logger()->warning('Classement PDF access rejected', [
                'reason' => 'unauthenticated',
                'route' => $request->path(),
                ...$this->buildAuthLogContext($request),
            ]);

            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        $allowedRoles = ['admin', 'superadmin'];
        if (!in_array($role, $allowedRoles, true)) {
            logger()->warning('Classement PDF access rejected', [
                'reason' => 'role_not_allowed',
                'route' => $request->path(),
                ...$this->buildAuthLogContext($request),
            ]);

            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $tokenAbilities = $this->tokenAbilitiesFor($user);
        if ($tokenAbilities !== [] && !$this->tokenAllowsAdmin($user)) {
            logger()->warning('Classement PDF access rejected', [
                'reason' => 'token_ability_missing',
                'route' => $request->path(),
                ...$this->buildAuthLogContext($request),
            ]);

            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        return null;
    }

    private function buildAuthLogContext(Request $request): array
    {
        $user = $request->user();
        $authorizationHeader = trim((string) $request->headers->get('Authorization', ''));
        $sessionCookieName = trim((string) config('session.cookie', ''));

        return [
            'user_id' => $user?->id,
            'user_type' => $user ? get_class($user) : null,
            'role' => $user?->role,
            'has_authorization_header' => $authorizationHeader !== '',
            'authorization_scheme' => $authorizationHeader !== '' ? strtok($authorizationHeader, ' ') : null,
            'bearer_token_present' => filled($request->bearerToken()),
            'session_cookie_present' => $sessionCookieName !== '' && $request->cookies->has($sessionCookieName),
            'xsrf_cookie_present' => $request->cookies->has('XSRF-TOKEN'),
            'token_abilities' => $this->tokenAbilitiesFor($user),
            'origin' => $request->headers->get('Origin'),
            'referer' => $request->headers->get('Referer'),
            'sanctum_guard_config' => config('sanctum.guard'),
        ];
    }

    private function tokenAbilitiesFor($user): array
    {
        $token = $user?->currentAccessToken();
        $abilities = $token?->abilities;

        return is_array($abilities) ? array_values($abilities) : [];
    }

    private function tokenAllowsAdmin($user): bool
    {
        return ($user?->tokenCan('admin') ?? false) || ($user?->tokenCan('superadmin') ?? false);
    }
}
