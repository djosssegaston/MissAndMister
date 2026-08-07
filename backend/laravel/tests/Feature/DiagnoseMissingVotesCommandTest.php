<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DiagnoseMissingVotesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_dumps_payment_and_log_clues_for_given_reference(): void
    {
        [$payment] = $this->seedSucceededPaymentWithoutVote();

        $this->artisan('payments:diagnose-missing-votes', [
            '--references' => [$payment->reference],
        ])->expectsOutputToContain('Paiement #'.$payment->id)
            ->expectsOutputToContain($payment->reference)
            ->assertExitCode(0);
    }

    public function test_command_scans_succeeded_fedapay_payments_without_vote(): void
    {
        [$payment] = $this->seedSucceededPaymentWithoutVote();

        $this->artisan('payments:diagnose-missing-votes', [
            '--limit' => 10,
        ])->expectsOutputToContain('Paiement #'.$payment->id)
            ->assertExitCode(0);
    }

    public function test_command_reports_activity_log_clue_with_candidate_id(): void
    {
        [$payment, $candidate] = $this->seedSucceededPaymentWithoutVote();

        ActivityLog::query()->create([
            'causer_id' => $payment->user_id,
            'causer_type' => User::class,
            'action' => 'vote_initiated',
            'ip_address' => '127.0.0.1',
            'meta' => [
                'candidate_id' => $candidate->id,
                'payment_id' => $payment->id,
            ],
            'status' => 'active',
        ]);

        $this->artisan('payments:diagnose-missing-votes', [
            '--references' => [$payment->reference],
        ])->expectsOutputToContain('vote_initiated')
            ->expectsOutputToContain((string) $candidate->id)
            ->assertExitCode(0);
    }

    public function test_command_suggests_candidate_from_description(): void
    {
        [$payment] = $this->seedSucceededPaymentWithoutVote('Awa Kossi');

        $this->artisan('payments:diagnose-missing-votes', [
            '--references' => [$payment->reference],
        ])->expectsOutputToContain('Awa Kossi')
            ->assertExitCode(0);
    }

    private function seedSucceededPaymentWithoutVote(string $candidateName = 'Awa Kossi'): array
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

        $user = User::query()->create([
            'name' => 'Voteur Test',
            'email' => 'voter@example.com',
            'phone' => '0100000000',
            'password' => bcrypt('password'),
            'role' => 'voter',
            'status' => 'active',
        ]);

        $payment = Payment::query()->create([
            'user_id' => $user->id,
            'provider' => 'fedapay',
            'reference' => 'ABCD1234EFGH',
            'transaction_id' => '112207071',
            'amount' => 100,
            'currency' => 'XOF',
            'status' => Payment::STATUS_SUCCEEDED,
            'meta' => [
                'voter_name' => $user->name,
                'voter_email' => $user->email,
                'voter_phone' => $user->phone,
                'ip' => '127.0.0.1',
            ],
            'payload' => [
                'fedapay' => [
                    'description' => 'Vote pour '.$candidateName,
                    'custom_metadata' => [],
                    'customer' => [
                        'email' => $user->email,
                    ],
                ],
            ],
            'paid_at' => now(),
        ]);

        return [$payment, $candidate];
    }
}
