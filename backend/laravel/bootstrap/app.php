<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use App\Console\Commands\BackupDatabase;
use App\Console\Commands\ReconcileFedapayPayments;
use App\Jobs\CalculateResultsJob;
use App\Jobs\DetectFraudJob;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->job(new CalculateResultsJob())->hourly();
        $schedule->job(new DetectFraudJob())->everyFifteenMinutes();
        $schedule->command(ReconcileFedapayPayments::class, ['--limit' => 50, '--recent-hours' => 2160])
            ->everyMinute()
            ->withoutOverlapping();
        $schedule->command(BackupDatabase::class)->dailyAt('02:00');
        $schedule->command('queue:prune-batches')->daily();
        $schedule->command('model:prune', ['--model' => 'App\\Models\\ActivityLog'])->daily();
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'force_password_change' => \App\Http\Middleware\ForcePasswordChange::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if (!$request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        });

        $exceptions->render(function (PostTooLargeException $exception, Request $request) {
            if (!$request->is('api/*')) {
                return null;
            }

            $limit = (string) (ini_get('post_max_size') ?: 'inconnue');
            $appLimitMb = max(1, (int) config('uploads.video.max_size_mb', 2048));
            $appLimitLabel = $appLimitMb >= 1024
                ? ((fmod($appLimitMb / 1024, 1.0) === 0.0
                    ? (string) (int) ($appLimitMb / 1024)
                    : rtrim(rtrim(number_format($appLimitMb / 1024, 1, '.', ''), '0'), '.')) . ' Go')
                : "{$appLimitMb} Mo";

            return response()->json([
                'message' => "Le fichier envoyé dépasse la limite actuelle du serveur ({$limit}). La plateforme est configurée pour accepter jusqu’à {$appLimitLabel}. Redémarrez PHP ou le serveur web après la mise à jour de la configuration puis réessayez.",
                'errors' => [
                    'upload' => ["Le fichier envoyé dépasse la limite actuelle du serveur ({$limit}). La plateforme est configurée pour accepter jusqu’à {$appLimitLabel}."],
                ],
            ], 413);
        });
    })->create();
