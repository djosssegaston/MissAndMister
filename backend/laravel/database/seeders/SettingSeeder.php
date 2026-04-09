<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            ['key' => 'price_per_vote',     'value' => '500',         'group' => 'payments'],
            ['key' => 'currency',           'value' => 'XOF',         'group' => 'payments'],
            ['key' => 'max_votes_per_day',  'value' => '200',         'group' => 'fraud'],
            ['key' => 'vote_start_at',      'value' => '2026-03-01',  'group' => 'dates'],
            ['key' => 'vote_end_at',        'value' => '2026-03-31',  'group' => 'dates'],
            ['key' => 'voting_open',        'value' => '1',           'group' => 'features'],
            ['key' => 'gallery_public',     'value' => '1',           'group' => 'features'],
            ['key' => 'results_public',     'value' => '0',           'group' => 'features'],
            ['key' => 'email_confirm',      'value' => '1',           'group' => 'notifications'],
            ['key' => 'sms_confirm',        'value' => '0',           'group' => 'notifications'],
            ['key' => 'captcha_enabled',    'value' => '1',           'group' => 'security'],
            ['key' => 'ip_tracking_enabled','value' => '1',           'group' => 'security'],
            ['key' => 'maintenance_mode',   'value' => '0',           'group' => 'security'],
        ];

        foreach ($settings as $setting) {
            Setting::firstOrCreate(
                ['key' => $setting['key']],
                [
                    'value' => $setting['value'],
                    'group' => $setting['group'],
                    'status' => 'active',
                ]
            );
        }
    }
}
