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

class AuditFedapayCandidateConflictsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_reports_candidate_conflict_without_mutating_data(): void
    {
        [$payment, $vote, $localCandidate, $remoteCandidate] = $this->seedConfirmedConflict();

        $mock = Mockery::mock(FedaPayService::class);
        $mock->shouldReceive('searchTransactions')
            ->once()
            ->andReturn([[
                'id' => $payment->transaction_id,
                'status' => 'approved',
                'amount' => $payment->amount,
                'currency' => ['iso' => 'XOF'],
                'merchant_reference' => $payment->reference,
                'description' => 'Vote pour ' . $remoteCandidate->first_name . ' ' . $remoteCandidate->last_name,
                'approved_at' => now()->toIso8601String(),
                'custom_metadata' => [
                    'payment_reference' => $payment->reference,
                    'candidate_id' => $remoteCandidate->id,
                    'candidate_name' => $remoteCandidate->first_name . ' ' . $remoteCandidate->last_name,
                    'provider' => 'fedapay',
                ],
            ]]);
        $mock->shouldReceive('environment')->andReturn('live');
        $mock->shouldReceive('apiBaseUrl')->andReturn('https://api.fedapay.com/v1');
        $this->app->instance(FedaPayService::class, $mock);

        $this->artisan('payments:audit-fedapay-candidate-conflicts', [
            '--pages' => 1,
            '--per-page' => 10,
            '--reference' => [$payment->reference],
        ])
            ->expectsOutputToContain($payment->reference)
            ->expectsOutputToContain($localCandidate->first_name . ' ' . $localCandidate->last_name)
            ->expectsOutputToContain($remoteCandidate->first_name . ' ' . $remoteCandidate->last_name)
            ->assertExitCode(0);

        $payment->refresh();
        $vote->refresh();

        $this->assertSame(Payment::STATUS_SUCCEEDED, $payment->status);
        $this->assertSame(Vote::STATUS_CONFIRMED, $vote->status);
    }

    private function seedConfirmedConflict(): array
    {
        $category = Category::query()->create([
            'name' => 'Miss',
            'slug' => 'miss',
            'description' => 'Concours Miss',
            'status' => 'active',
            'position' => 0,
        ]);

        $localCandidate = Candidate::query()->create([
            'category_id' => $category->id,
            'first_name' => 'Awa',
            'last_name' => 'Kossi',
            'public_number' => 1,
            'slug' => 'awa-kossi',
            'status' => 'active',
            'public_uid' => '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        ]);

        $remoteCandidate = Candidate::query()->create([
            'category_id' => $category->id,
            'first_name' => 'Mina',
            'last_name' => 'Dossou',
            'public_number' => 2,
            'slug' => 'mina-dossou',
            'status' => 'active',
            'public_uid' => '01ARZ3NDEKTSV4RRFFQ69G5FB0',
        ]);

        $payment = Payment::query()->create([
            'provider' => 'fedapay',
            'reference' => 'CONFLICT1234',
            'transaction_id' => '110000001',
            'amount' => 500,
            'currency' => 'XOF',
            'status' => Payment::STATUS_SUCCEEDED,
            'meta' => [
                'candidate_id' => $localCandidate->id,
                'candidate_name' => 'Awa Kossi',
                'ip' => '127.0.0.1',
                'quantity' => 1,
            ],
            'payload' => [],
        ]);

        $vote = Vote::query()->create([
            'candidate_id' => $localCandidate->id,
            'payment_id' => $payment->id,
            'amount' => 500,
            'quantity' => 1,
            'currency' => 'XOF',
            'status' => Vote::STATUS_CONFIRMED,
            'ip_address' => '127.0.0.1',
            'meta' => [],
        ]);

        return [$payment, $vote, $localCandidate, $remoteCandidate];
    }
}
