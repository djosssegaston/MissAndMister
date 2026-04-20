<?php

namespace Tests\Feature;

use App\Jobs\ProcessFedapayWebhookJob;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Vote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
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

    public function test_webhook_confirms_vote_from_nested_entity_status_when_remote_lookup_fails(): void
    {
        config()->set('services.fedapay.webhook_secret', 'whsec_test');
        config()->set('services.fedapay.secret_key', 'sk_test');
        config()->set('services.fedapay.environment', 'sandbox');
        config()->set('services.fedapay.webhook_async', false);

        $category = Category::query()->create([
            'name' => 'Miss',
            'slug' => 'miss',
            'description' => 'Concours Miss',
            'status' => 'active',
            'position' => 0,
        ]);

        $candidate = Candidate::query()->create([
            'category_id' => $category->id,
            'first_name' => 'Awa',
            'last_name' => 'Kossi',
            'public_number' => 1,
            'slug' => 'awa-kossi',
            'status' => 'active',
            'public_uid' => '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        ]);

        $payment = Payment::query()->create([
            'provider' => 'fedapay',
            'reference' => 'ABCD1234EFGH',
            'transaction_id' => '987654',
            'amount' => 500,
            'currency' => 'XOF',
            'status' => 'initiated',
            'meta' => [
                'candidate_id' => $candidate->id,
                'candidate_name' => 'Awa Kossi',
                'ip' => '127.0.0.1',
            ],
            'payload' => [],
        ]);

        $vote = Vote::query()->create([
            'candidate_id' => $candidate->id,
            'payment_id' => $payment->id,
            'amount' => 500,
            'quantity' => 1,
            'currency' => 'XOF',
            'status' => 'pending',
            'ip_address' => '127.0.0.1',
            'meta' => [],
        ]);

        $payload = [
            'name' => 'transaction.updated',
            'data' => [
                'entity' => [
                    'id' => '987654',
                    'status' => 'approved',
                    'merchant_reference' => $payment->reference,
                ],
            ],
        ];

        $response = $this->postSignedWebhook($payload, 'whsec_test');

        $response
            ->assertStatus(200)
            ->assertJsonPath('result', 'applied')
            ->assertJsonPath('outcome', Payment::STATUS_SUCCEEDED);

        $payment->refresh();
        $vote->refresh();

        $this->assertSame(Payment::STATUS_SUCCEEDED, $payment->status);
        $this->assertSame(Vote::STATUS_CONFIRMED, $vote->status);
    }

    public function test_webhook_queues_processing_when_async_enabled(): void
    {
        config()->set('services.fedapay.webhook_secret', 'whsec_test');
        config()->set('services.fedapay.webhook_async', true);
        Queue::fake();

        $payload = [
            'name' => 'transaction.updated',
            'data' => [
                'entity' => [
                    'id' => 'tx_async_001',
                    'status' => 'approved',
                    'merchant_reference' => 'ASYNCREF001',
                ],
            ],
        ];

        $response = $this->postSignedWebhook($payload, 'whsec_test');

        $response
            ->assertStatus(200)
            ->assertJsonPath('result', 'queued')
            ->assertJsonPath('outcome', 'processing');

        Queue::assertPushed(ProcessFedapayWebhookJob::class);
    }

    private function postSignedWebhook(array $payload, string $secret): TestResponse
    {
        $raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
        $signature = hash_hmac('sha256', $raw, $secret);

        return $this->call(
            'POST',
            '/api/payment/webhook',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_FEDAPAY_SIGNATURE' => $signature,
            ],
            $raw
        );
    }
}
