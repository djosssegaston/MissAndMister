<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Vote;
use App\Services\FedaPayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class ReconcileMissingFedapayVotesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_dry_run_reports_problem_without_mutating_data(): void
    {
        [$payment, $vote] = $this->seedPendingPaymentAndVote();

        $mock = Mockery::mock(FedaPayService::class);
        $mock->shouldReceive('searchTransactions')
            ->once()
            ->andReturn([$this->remoteSuccessfulTransaction($payment->reference, $payment->transaction_id, $payment->amount, $vote->candidate_id)]);
        $mock->shouldReceive('environment')->andReturn('live');
        $mock->shouldReceive('apiBaseUrl')->andReturn('https://api.fedapay.com/v1');
        $this->app->instance(FedaPayService::class, $mock);

        $this->artisan('payments:reconcile-missing-fedapay-votes', [
            '--pages' => 1,
            '--per-page' => 10,
        ])->assertExitCode(0);

        $payment->refresh();
        $vote->refresh();

        $this->assertSame('initiated', $payment->status);
        $this->assertSame('pending', $vote->status);
        $this->assertNull(data_get($vote->meta, 'source'));
    }

    public function test_command_apply_confirms_and_tags_missing_vote(): void
    {
        [$payment, $vote] = $this->seedPendingPaymentAndVote();

        $mock = Mockery::mock(FedaPayService::class);
        $mock->shouldReceive('searchTransactions')
            ->once()
            ->andReturn([$this->remoteSuccessfulTransaction($payment->reference, $payment->transaction_id, $payment->amount, $vote->candidate_id)]);
        $mock->shouldReceive('environment')->andReturn('live');
        $mock->shouldReceive('apiBaseUrl')->andReturn('https://api.fedapay.com/v1');
        $this->app->instance(FedaPayService::class, $mock);

        $this->artisan('payments:reconcile-missing-fedapay-votes', [
            '--pages' => 1,
            '--per-page' => 10,
            '--apply' => true,
        ])->assertExitCode(0);

        $payment->refresh();
        $vote->refresh();

        $this->assertSame(Payment::STATUS_SUCCEEDED, $payment->status);
        $this->assertSame(Vote::STATUS_CONFIRMED, $vote->status);
        $this->assertSame('reconciliation', data_get($vote->meta, 'source'));
        $this->assertSame($payment->transaction_id, data_get($vote->meta, 'reconciliation.transaction_id'));
        $this->assertSame($payment->reference, data_get($vote->meta, 'reconciliation.reference'));
    }

    private function seedPendingPaymentAndVote(): array
    {
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
                'quantity' => 1,
                'voter_email' => 'awa@example.com',
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

        return [$payment, $vote];
    }

    private function remoteSuccessfulTransaction(string $reference, string $transactionId, float $amount, int $candidateId): array
    {
        return [
            'id' => $transactionId,
            'status' => 'approved',
            'amount' => $amount,
            'currency' => [
                'iso' => 'XOF',
            ],
            'merchant_reference' => $reference,
            'description' => 'Vote pour Awa Kossi',
            'approved_at' => now()->toIso8601String(),
            'custom_metadata' => [
                'payment_reference' => $reference,
                'candidate_id' => $candidateId,
                'candidate_name' => 'Awa Kossi',
                'provider' => 'fedapay',
                'quantity' => 1,
                'voter_email' => 'awa@example.com',
            ],
        ];
    }
}
