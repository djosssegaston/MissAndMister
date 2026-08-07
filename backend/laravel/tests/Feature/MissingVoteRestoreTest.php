<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Vote;
use App\Services\FedaPayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use Tests\TestCase;

class MissingVoteRestoreTest extends TestCase
{
    use RefreshDatabase;

    private ?Candidate $seededCandidate = null;

    public function test_reconcile_command_restores_missing_vote_from_remote_description(): void
    {
        $payment = $this->seedSucceededPaymentWithoutVote('112207071');

        $mock = Mockery::mock(FedaPayService::class);
        $mock->shouldReceive('searchTransactions')
            ->once()
            ->andReturn([$this->remoteTransaction($payment->reference, $payment->transaction_id, $payment->amount)]);
        $this->app->instance(FedaPayService::class, $mock);

        $this->artisan('payments:reconcile-missing-fedapay-votes', [
            '--pages' => 1,
            '--per-page' => 10,
            '--apply' => true,
        ])->assertExitCode(0);

        $payment->refresh();

        $this->assertNotNull($payment->vote);
        $this->assertSame(Vote::STATUS_CONFIRMED, $payment->vote->status);
        $this->assertSame($this->candidate()->id, $payment->vote->candidate_id);
        $this->assertSame('reconciliation', data_get($payment->vote->meta, 'source'));
    }

    public function test_webhook_confirms_missing_vote_from_remote_description(): void
    {
        config()->set('services.fedapay.webhook_secret', 'whsec_test');
        config()->set('services.fedapay.secret_key', 'sk_test');
        config()->set('services.fedapay.environment', 'sandbox');
        config()->set('services.fedapay.webhook_async', false);

        $payment = $this->seedSucceededPaymentWithoutVote('tx_webhook_1');

        Http::fake([
            'https://sandbox-api.fedapay.com/v1/transactions/tx_webhook_1' => Http::response(
                $this->remoteTransaction($payment->reference, 'tx_webhook_1', $payment->amount),
                200
            ),
        ]);

        $payload = [
            'name' => 'transaction.approved',
            'data' => [
                'entity' => [
                    'id' => 'tx_webhook_1',
                    'status' => 'approved',
                    'merchant_reference' => $payment->reference,
                ],
            ],
        ];

        $raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
        $signature = hash_hmac('sha256', $raw, 'whsec_test');

        $this->call(
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
        )->assertStatus(200);

        $payment->refresh();

        $this->assertNotNull($payment->vote);
        $this->assertSame(Vote::STATUS_CONFIRMED, $payment->vote->status);
        $this->assertSame($this->candidate()->id, $payment->vote->candidate_id);
    }

    public function test_auto_reconcile_command_restores_missing_vote_from_remote_description(): void
    {
        $payment = $this->seedSucceededPaymentWithoutVote('tx_auto_1');

        Http::fake([
            'https://sandbox-api.fedapay.com/v1/transactions/tx_auto_1' => Http::response(
                $this->remoteTransaction($payment->reference, 'tx_auto_1', $payment->amount),
                200
            ),
        ]);

        config()->set('services.fedapay.secret_key', 'sk_test');
        config()->set('services.fedapay.environment', 'sandbox');

        $this->artisan('payments:reconcile-fedapay', [
            '--limit' => 10,
        ])->assertExitCode(0);

        $payment->refresh();

        $this->assertNotNull($payment->vote);
        $this->assertSame(Vote::STATUS_CONFIRMED, $payment->vote->status);
        $this->assertSame($this->candidate()->id, $payment->vote->candidate_id);
    }

    public function test_webhook_restores_missing_vote_from_payload_when_remote_unavailable(): void
    {
        config()->set('services.fedapay.webhook_secret', 'whsec_test');
        config()->set('services.fedapay.secret_key', 'sk_test');
        config()->set('services.fedapay.environment', 'sandbox');
        config()->set('services.fedapay.webhook_async', false);

        $payment = $this->seedSucceededPaymentWithoutVote('tx_webhook_2');

        Http::fake([
            'https://sandbox-api.fedapay.com/v1/transactions/tx_webhook_2' => Http::response([], 404),
        ]);

        $payload = [
            'name' => 'transaction.approved',
            'data' => [
                'entity' => [
                    'id' => 'tx_webhook_2',
                    'status' => 'approved',
                    'merchant_reference' => $payment->reference,
                    'description' => 'Vote pour Awa Kossi',
                    'custom_metadata' => [
                        'payment_reference' => $payment->reference,
                        'provider' => 'fedapay',
                        'quantity' => 1,
                    ],
                ],
            ],
        ];

        $raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
        $signature = hash_hmac('sha256', $raw, 'whsec_test');

        $this->call(
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
        )->assertStatus(200);

        $payment->refresh();

        $this->assertNotNull($payment->vote);
        $this->assertSame(Vote::STATUS_CONFIRMED, $payment->vote->status);
        $this->assertSame($this->candidate()->id, $payment->vote->candidate_id);
    }

    public function test_auto_reconcile_does_not_create_vote_without_resolvable_candidate_and_debounces(): void
    {
        $payment = $this->seedSucceededPaymentWithoutVote('tx_nocand_1');

        Http::fake([
            'https://sandbox-api.fedapay.com/v1/transactions/tx_nocand_1' => Http::response([
                'id' => 'tx_nocand_1',
                'status' => 'transferred',
                'merchant_reference' => $payment->reference,
                'description' => 'Paiement securise Miss & Mister',
                'custom_metadata' => [],
            ], 200),
        ]);

        config()->set('services.fedapay.secret_key', 'sk_test');
        config()->set('services.fedapay.environment', 'sandbox');

        $this->artisan('payments:reconcile-fedapay', [
            '--limit' => 10,
        ])->assertExitCode(0);

        $payment->refresh();

        $this->assertNull($payment->vote);
        $this->assertGreaterThan(0, (int) data_get($payment->meta, 'reconcile_vote_attempt_at'));
    }

    public function test_auto_reconcile_does_not_create_vote_for_billetterie_payment(): void
    {
        $payment = Payment::query()->create([
            'provider' => 'fedapay',
            'reference' => 'BILLET67890',
            'transaction_id' => 'tx_billet_1',
            'amount' => 100,
            'currency' => 'XOF',
            'status' => Payment::STATUS_SUCCEEDED,
            'meta' => ['quantity' => 1, 'ip' => '127.0.0.1'],
            'payload' => [],
            'paid_at' => now(),
        ]);

        Http::fake([
            'https://sandbox-api.fedapay.com/v1/transactions/tx_billet_1' => Http::response([
                'id' => 'tx_billet_1',
                'status' => 'transferred',
                'merchant_reference' => $payment->reference,
                'description' => 'Paiement sécurisé Miss & Mister',
                'custom_metadata' => [
                    'type' => 'billetterie',
                    'event_id' => 2,
                    'event_name' => 'SOIRÉE DE COURONNEMENT',
                    'quantity' => 1,
                ],
            ], 200),
        ]);

        config()->set('services.fedapay.secret_key', 'sk_test');
        config()->set('services.fedapay.environment', 'sandbox');

        $this->artisan('payments:reconcile-fedapay', [
            '--limit' => 10,
        ])->assertExitCode(0);

        $payment->refresh();

        $this->assertNull($payment->vote);
    }

    private function seedSucceededPaymentWithoutVote(string $transactionId): Payment
    {
        $candidate = $this->candidate();

        return Payment::query()->create([
            'provider' => 'fedapay',
            'reference' => 'ABCD1234EFGH',
            'transaction_id' => $transactionId,
            'amount' => 100,
            'currency' => 'XOF',
            'status' => Payment::STATUS_SUCCEEDED,
            'meta' => [
                'quantity' => 1,
                'ip' => '127.0.0.1',
            ],
            'payload' => [],
            'paid_at' => now(),
        ]);
    }

    private function candidate(): Candidate
    {
        if ($this->seededCandidate) {
            return $this->seededCandidate;
        }

        $category = Category::query()->create([
            'name' => 'Miss',
            'slug' => 'miss',
            'description' => 'Concours Miss',
            'status' => 'active',
            'position' => 0,
        ]);

        return $this->seededCandidate = Candidate::query()->create([
            'category_id' => $category->id,
            'first_name' => 'Awa',
            'last_name' => 'Kossi',
            'public_number' => 1,
            'slug' => 'awa-kossi',
            'status' => 'active',
            'public_uid' => '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        ]);
    }

    private function remoteTransaction(string $reference, string $transactionId, float $amount): array
    {
        return [
            'id' => $transactionId,
            'status' => 'transferred',
            'amount' => $amount,
            'currency' => [
                'iso' => 'XOF',
            ],
            'merchant_reference' => $reference,
            'description' => 'Vote pour Awa Kossi',
            'custom_metadata' => [
                'payment_reference' => $reference,
                'provider' => 'fedapay',
                'quantity' => 1,
            ],
        ];
    }
}
