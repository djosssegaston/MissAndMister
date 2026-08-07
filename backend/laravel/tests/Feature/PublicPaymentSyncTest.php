<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Vote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicPaymentSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_sync_returns_vote_status_and_candidate_totals_for_confirmed_payment(): void
    {
        [$candidate, $payment] = $this->seedPaymentAndVote(Payment::STATUS_SUCCEEDED, Vote::STATUS_CONFIRMED);

        $response = $this->getJson('/api/public/payments/'.$payment->reference.'/sync');

        $response
            ->assertOk()
            ->assertJsonPath('reference', $payment->reference)
            ->assertJsonPath('payment_status', Payment::STATUS_SUCCEEDED)
            ->assertJsonPath('vote_status', Vote::STATUS_CONFIRMED)
            ->assertJsonPath('candidate_name', 'Awa Kossi')
            ->assertJsonPath('quantity', 2)
            ->assertJsonPath('candidate_votes_count', 2)
            ->assertJsonPath('votes_count', 2)
            ->assertJsonPath('votes', 2)
            ->assertJsonMissing(['transaction_id']);
    }

    public function test_public_sync_reports_pending_statuses_until_payment_is_confirmed(): void
    {
        [$candidate, $payment] = $this->seedPaymentAndVote('initiated', 'pending');

        $this->getJson('/api/public/payments/'.$payment->reference.'/sync')
            ->assertOk()
            ->assertJsonPath('payment_status', 'initiated')
            ->assertJsonPath('vote_status', 'pending');
    }

    public function test_public_sync_returns_not_found_for_unknown_reference(): void
    {
        $this->getJson('/api/public/payments/UNKNOWNREF/sync')
            ->assertStatus(404);
    }

    /**
     * @return array{0: Candidate, 1: Payment}
     */
    private function seedPaymentAndVote(string $paymentStatus, string $voteStatus): array
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
            'reference' => 'CONFIRMED001',
            'transaction_id' => null,
            'amount' => 500,
            'currency' => 'XOF',
            'status' => $paymentStatus,
            'meta' => [
                'candidate_id' => $candidate->id,
                'candidate_name' => 'Awa Kossi',
            ],
            'payload' => [],
        ]);

        Vote::query()->create([
            'candidate_id' => $candidate->id,
            'payment_id' => $payment->id,
            'amount' => 500,
            'quantity' => 2,
            'currency' => 'XOF',
            'status' => $voteStatus,
            'ip_address' => '127.0.0.1',
            'meta' => [],
        ]);

        return [$candidate, $payment];
    }
}
