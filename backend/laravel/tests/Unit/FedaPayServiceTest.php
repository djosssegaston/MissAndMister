<?php

namespace Tests\Unit;

use App\Models\Setting;
use App\Services\FedaPayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FedaPayServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reads_fedapay_configuration_from_server_config_only(): void
    {
        config()->set('services.fedapay.public_key', 'pk_live_from_config');
        config()->set('services.fedapay.secret_key', 'sk_live_from_config');
        config()->set('services.fedapay.webhook_secret', 'whsec_from_config');
        config()->set('services.fedapay.environment', 'live');

        Setting::query()->create([
            'key' => 'fedapay_public_key',
            'value' => 'pk_from_database',
            'group' => 'payments',
            'status' => 'active',
        ]);

        Setting::query()->create([
            'key' => 'fedapay_secret_key',
            'value' => 'sk_from_database',
            'group' => 'payments',
            'status' => 'active',
        ]);

        $service = app(FedaPayService::class);

        $this->assertSame('pk_live_from_config', $service->publicKey());
        $this->assertSame('sk_live_from_config', $service->secretKey());
        $this->assertSame('whsec_from_config', $service->webhookSecret());
        $this->assertSame('live', $service->environment());
    }

    public function test_it_accepts_timestamped_webhook_signature_header_format(): void
    {
        config()->set('services.fedapay.webhook_secret', 'whsec_test');

        $service = app(FedaPayService::class);
        $payload = '{"name":"transaction.updated","data":{"entity":{"id":"123"}}}';
        $timestamp = '1776594709';
        $signature = hash_hmac('sha256', $timestamp . '.' . $payload, 'whsec_test');

        $this->assertTrue(
            $service->verifyWebhookSignature($payload, "t={$timestamp},s={$signature}")
        );
    }
}
