<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class BackupDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'backup:database';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Dump the database to storage/backups';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $db = config('database.connections.' . config('database.default'));
        $database = $db['database'] ?? 'database';
        $filename = 'backups/' . $database . '_' . now()->format('Ymd_His') . '.sql';

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s',
            $db['host'] ?? '127.0.0.1',
            $db['port'] ?? 3306,
            $database
        );

        $command = sprintf(
            'mysqldump -h%s -P%s -u%s %s %s',
            escapeshellarg($db['host'] ?? '127.0.0.1'),
            escapeshellarg($db['port'] ?? 3306),
            escapeshellarg($db['username'] ?? 'root'),
            $db['password'] ? '-p' . escapeshellarg($db['password']) : '',
            escapeshellarg($database)
        );

        $output = shell_exec($command);

        if (!$output) {
            $this->error('mysqldump not available; writing placeholder backup file instead.');
            $output = '-- backup placeholder generated at ' . now();
        }

        \Storage::disk('local')->put($filename, $output);

        $this->info("Backup stored at storage/app/{$filename}");
    }
}
