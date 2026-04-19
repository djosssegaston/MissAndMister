<?php

namespace App\Console;

use App\Console\Commands\BackupDatabase;
use App\Console\Commands\ReconcileFedapayPayments;
use App\Jobs\CalculateResultsJob;
use App\Jobs\DetectFraudJob;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        $schedule->job(new CalculateResultsJob())->hourly();
        $schedule->job(new DetectFraudJob())->everyFifteenMinutes();
        $schedule->command(ReconcileFedapayPayments::class, ['--limit' => 50, '--recent-hours' => 2160])->everyMinute()->withoutOverlapping();
        $schedule->command(BackupDatabase::class)->dailyAt('02:00');
        $schedule->command('queue:prune-batches')->daily();
        $schedule->command('model:prune', ['--model' => 'App\\Models\\ActivityLog'])->daily();
    }

    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');
        require base_path('routes/console.php');
    }
}
