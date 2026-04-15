<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $paymentSettingKeys = [
        'fedapay_public_key',
        'fedapay_secret_key',
        'fedapay_webhook_secret',
        'fedapay_environment',
    ];

    public function up(): void
    {
        DB::table('settings')
            ->whereIn('key', $this->paymentSettingKeys)
            ->update([
                'status' => 'inactive',
                'deleted_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('settings')
            ->whereIn('key', $this->paymentSettingKeys)
            ->update([
                'status' => 'active',
                'deleted_at' => null,
                'updated_at' => now(),
            ]);
    }
};
