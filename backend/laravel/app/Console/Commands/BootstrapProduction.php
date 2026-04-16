<?php

namespace App\Console\Commands;

use App\Models\Admin;
use App\Models\Category;
use App\Models\Setting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class BootstrapProduction extends Command
{
    protected $signature = 'app:bootstrap-production';

    protected $description = 'Bootstrap required production data without running the full seed suite';

    public function handle(): int
    {
        $now = now();

        Category::query()->upsert(
            collect([
                ['name' => 'Miss', 'description' => 'Concours Miss'],
                ['name' => 'Mister', 'description' => 'Concours Mister'],
            ])->map(function (array $category, int $index) use ($now): array {
                return [
                    'name' => $category['name'],
                    'slug' => Str::slug($category['name']),
                    'description' => $category['description'],
                    'status' => 'active',
                    'position' => $index,
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })->all(),
            ['name'],
            ['slug', 'description', 'status', 'position', 'deleted_at', 'updated_at']
        );

        Setting::query()->upsert(
            collect([
                ['key' => 'price_per_vote', 'value' => '500', 'group' => 'payments'],
                ['key' => 'currency', 'value' => 'XOF', 'group' => 'payments'],
                ['key' => 'max_votes_per_day', 'value' => '200', 'group' => 'fraud'],
                ['key' => 'vote_start_at', 'value' => '2026-03-01', 'group' => 'dates'],
                ['key' => 'vote_end_at', 'value' => '2026-03-31', 'group' => 'dates'],
                ['key' => 'voting_open', 'value' => '1', 'group' => 'features'],
                ['key' => 'gallery_public', 'value' => '1', 'group' => 'features'],
                ['key' => 'results_public', 'value' => '0', 'group' => 'features'],
                ['key' => 'email_confirm', 'value' => '1', 'group' => 'notifications'],
                ['key' => 'sms_confirm', 'value' => '0', 'group' => 'notifications'],
                ['key' => 'captcha_enabled', 'value' => '1', 'group' => 'security'],
                ['key' => 'ip_tracking_enabled', 'value' => '1', 'group' => 'security'],
                ['key' => 'maintenance_mode', 'value' => '0', 'group' => 'security'],
            ])->map(fn (array $setting): array => [
                'key' => $setting['key'],
                'value' => $setting['value'],
                'group' => $setting['group'],
                'status' => 'active',
                'deleted_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all(),
            ['key'],
            ['value', 'group', 'status', 'deleted_at', 'updated_at']
        );

        $this->upsertAdminFromEnv('PROD_ADMIN', 'superadmin');
        $this->upsertAdminFromEnv('STAFF_ADMIN', 'admin');

        $this->info('Production bootstrap completed.');

        return self::SUCCESS;
    }

    private function upsertAdminFromEnv(string $prefix, string $defaultRole): void
    {
        $email = trim((string) env("{$prefix}_EMAIL", ''));
        $password = (string) env("{$prefix}_PASSWORD", '');

        if ($email === '' || $password === '') {
            return;
        }

        $admin = Admin::withTrashed()->firstOrNew(['email' => $email]);
        $admin->name = trim((string) env("{$prefix}_NAME", 'Admin')) ?: 'Admin';
        $admin->phone = trim((string) env("{$prefix}_PHONE", '0000000000')) ?: '0000000000';
        $admin->password = Hash::make($password);
        $admin->role = trim((string) env("{$prefix}_ROLE", $defaultRole)) ?: $defaultRole;
        $admin->status = trim((string) env("{$prefix}_STATUS", 'active')) ?: 'active';
        $admin->deleted_at = null;
        $admin->save();
    }
}
