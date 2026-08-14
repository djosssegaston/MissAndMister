<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Result;
use App\Models\Vote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecountVotesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_recounts_confirmed_votes_and_persists_results(): void
    {
        $candidate = $this->candidate();

        $this->seedConfirmedVote($candidate, quantity: 2, amount: 200);
        $this->seedConfirmedVote($candidate, quantity: 3, amount: 300);

        $this->artisan('votes:recount')->assertExitCode(0);

        $result = Result::query()->where('candidate_id', $candidate->id)->first();

        $this->assertNotNull($result);
        $this->assertSame(5, (int) $result->total_votes);
        $this->assertSame(500.0, (float) $result->total_amount);
        $this->assertSame($candidate->category_id, $result->category_id);
    }

    public function test_command_provider_filter_only_counts_selected_providers(): void
    {
        $candidate = $this->candidate();

        $this->seedConfirmedVote($candidate, quantity: 2, amount: 200, provider: 'fedapay');
        $this->seedConfirmedVote($candidate, quantity: 5, amount: 500, provider: 'kkiapay');

        $this->artisan('votes:recount', ['--provider' => ['fedapay']])->assertExitCode(0);

        $result = Result::query()->where('candidate_id', $candidate->id)->first();

        $this->assertNotNull($result);
        $this->assertSame(2, (int) $result->total_votes);
        $this->assertSame(200.0, (float) $result->total_amount);
    }

    public function test_dry_run_does_not_persist_results(): void
    {
        $candidate = $this->candidate();

        $this->seedConfirmedVote($candidate, quantity: 1, amount: 100);

        $this->artisan('votes:recount', ['--dry-run' => true])->assertExitCode(0);

        $this->assertSame(0, Result::query()->count());
    }

    public function test_command_does_not_count_pending_or_cancelled_votes(): void
    {
        $candidate = $this->candidate();

        $this->seedConfirmedVote($candidate, quantity: 4, amount: 400);
        $this->seedVote($candidate, quantity: 9, amount: 900, status: 'pending');
        $this->seedVote($candidate, quantity: 7, amount: 700, status: 'cancelled');

        $this->artisan('votes:recount')->assertExitCode(0);

        $result = Result::query()->where('candidate_id', $candidate->id)->first();

        $this->assertSame(4, (int) $result->total_votes);
        $this->assertSame(400.0, (float) $result->total_amount);
    }

    private function candidate(): Candidate
    {
        $category = Category::query()->create([
            'name' => 'Miss',
            'slug' => 'miss',
            'description' => 'Concours Miss',
            'status' => 'active',
            'position' => 0,
        ]);

        return Candidate::query()->create([
            'category_id' => $category->id,
            'first_name' => 'Awa',
            'last_name' => 'Kossi',
            'public_number' => 1,
            'slug' => 'awa-kossi',
            'status' => 'active',
            'public_uid' => '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        ]);
    }

    private function seedConfirmedVote(Candidate $candidate, int $quantity, float $amount, string $provider = 'fedapay'): void
    {
        $this->seedVote($candidate, $quantity, $amount, Vote::STATUS_CONFIRMED, $provider);
    }

    private function seedVote(Candidate $candidate, int $quantity, float $amount, string $status, string $provider = 'fedapay'): void
    {
        $payment = Payment::query()->create([
            'provider' => $provider,
            'reference' => 'REF'.strtoupper(bin2hex(random_bytes(4))),
            'transaction_id' => 'tx_'.bin2hex(random_bytes(4)),
            'amount' => $amount,
            'currency' => 'XOF',
            'status' => Payment::STATUS_SUCCEEDED,
            'meta' => ['quantity' => $quantity],
            'payload' => [],
            'paid_at' => now(),
        ]);

        Vote::query()->create([
            'candidate_id' => $candidate->id,
            'payment_id' => $payment->id,
            'amount' => $amount,
            'quantity' => $quantity,
            'currency' => 'XOF',
            'status' => $status,
            'ip_address' => '127.0.0.1',
            'meta' => [],
        ]);
    }
}
