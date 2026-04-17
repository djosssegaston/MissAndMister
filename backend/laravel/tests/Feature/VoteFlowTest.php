<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Category;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\Vote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VoteFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_vote_endpoint_uses_server_side_amount_calculation(): void
    {
        config()->set('services.fedapay.secret_key', 'test-secret');
        config()->set('services.fedapay.public_key', 'test-public');
        config()->set('services.fedapay.environment', 'sandbox');

        Http::fake([
            'https://sandbox-api.fedapay.com/v1/transactions' => Http::response([
                'id' => 987654,
                'status' => 'pending',
            ], 200),
            'https://sandbox-api.fedapay.com/v1/transactions/987654/token' => Http::response([
                'token' => 'checkout-token',
                'url' => 'https://checkout.fedapay.com/pay/checkout-token',
            ], 200),
        ]);

        Setting::updateOrCreate(
            ['key' => 'price_per_vote'],
            ['value' => '500', 'group' => 'payments', 'status' => 'active']
        );

        $category = Category::create([
            'name' => 'Miss',
            'slug' => 'miss',
            'description' => 'Concours Miss',
            'status' => 'active',
            'position' => 0,
        ]);

        $candidate = Candidate::factory()->create([
            'category_id' => $category->id,
            'public_number' => 15,
        ]);

        $response = $this->postJson('/api/votes', [
            'candidate_id' => $candidate->id,
            'quantity' => 3,
            'amount' => 100,
            'currency' => 'XOF',
        ]);

        $response->assertCreated()
            ->assertJsonPath('payment.amount', 1500)
            ->assertJsonPath('vote.amount', 1500)
            ->assertJsonPath('vote.quantity', 3);

        $payment = Payment::query()->firstOrFail();
        $vote = Vote::query()->firstOrFail();

        $this->assertSame(1500.0, (float) $payment->amount);
        $this->assertSame(1500.0, (float) $vote->amount);
        $this->assertSame(3, $vote->quantity);
        $this->assertSame(500, (int) data_get($payment->meta, 'unit_price'));
    }
}
