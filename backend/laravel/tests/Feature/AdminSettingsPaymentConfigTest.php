<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminSettingsPaymentConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_settings_endpoint_does_not_expose_fedapay_keys(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin, ['admin']);

        Setting::query()->create([
            'key' => 'fedapay_public_key',
            'value' => 'pk_should_not_leak',
            'group' => 'payments',
            'status' => 'active',
        ]);

        Setting::query()->create([
            'key' => 'results_public',
            'value' => '1',
            'group' => 'features',
            'status' => 'active',
        ]);

        $response = $this->getJson('/api/admin/settings');

        $response->assertOk();
        $response->assertJsonMissingPath('fedapay_public_key');
        $response->assertJsonPath('results_public', true);
    }

    public function test_admin_settings_store_ignores_fedapay_keys(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin, ['admin']);

        $response = $this->postJson('/api/admin/settings', [
            'results_public' => true,
            'fedapay_public_key' => 'pk_should_be_ignored',
            'fedapay_secret_key' => 'sk_should_be_ignored',
            'fedapay_webhook_secret' => 'whsec_should_be_ignored',
            'fedapay_environment' => 'live',
        ]);

        $response->assertCreated();
        $response->assertJsonMissingPath('fedapay_public_key');
        $response->assertJsonPath('results_public', true);

        $this->assertDatabaseHas('settings', [
            'key' => 'results_public',
            'value' => '1',
        ]);

        $this->assertDatabaseMissing('settings', [
            'key' => 'fedapay_public_key',
        ]);
        $this->assertDatabaseMissing('settings', [
            'key' => 'fedapay_secret_key',
        ]);
        $this->assertDatabaseMissing('settings', [
            'key' => 'fedapay_webhook_secret',
        ]);
        $this->assertDatabaseMissing('settings', [
            'key' => 'fedapay_environment',
        ]);
    }

    public function test_admin_settings_update_rejects_legacy_fedapay_records(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin, ['admin']);

        $setting = Setting::query()->create([
            'key' => 'fedapay_public_key',
            'value' => 'pk_legacy_value',
            'group' => 'payments',
            'status' => 'active',
        ]);

        $response = $this->patchJson("/api/admin/settings/{$setting->id}", [
            'value' => 'pk_new_value',
        ]);

        $response->assertNotFound();

        $this->assertDatabaseHas('settings', [
            'id' => $setting->id,
            'value' => 'pk_legacy_value',
        ]);
    }
}
