<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class PaymentWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_webhook_rejects_invalid_signature(): void
    {
        $response = $this->postJson('/api/payment/webhook', [
            'reference' => 'ref',
            'status' => 'SUCCESS',
        ]);

        $response->assertStatus(401);
    }
}
