<?php

namespace Tests\Feature;

use App\Mail\CandidateInvitationMail;
use App\Mail\PasswordChangedConfirmationMail;
use App\Models\Admin;
use App\Models\Candidate;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CandidateOnboardingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_candidate_with_linked_account_and_send_invitation(): void
    {
        Mail::fake();

        $admin = Admin::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'phone' => '97000000',
            'password' => Hash::make('AdminPass!123'),
            'role' => 'admin',
            'status' => 'active',
        ]);
        $category = Category::create([
            'name' => 'Miss',
            'slug' => 'miss',
            'description' => 'Miss',
            'status' => 'active',
            'position' => 1,
        ]);

        Sanctum::actingAs($admin, ['admin']);

        $response = $this->postJson('/api/admin/candidates', [
            'category_id' => $category->id,
            'first_name' => 'Aicha',
            'last_name' => 'Kouassi',
            'email' => 'candidate@example.com',
            'phone' => '96000000',
            'password' => 'Candidate!123',
            'password_confirmation' => 'Candidate!123',
            'description' => 'Candidate officielle',
            'city' => 'Cotonou',
            'university' => 'UAC',
            'age' => 23,
            'status' => 'active',
            'is_active' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('candidate.email', 'candidate@example.com');

        $candidate = Candidate::where('email', 'candidate@example.com')->first();

        $this->assertNotNull($candidate);
        $this->assertDatabaseHas('users', [
            'candidate_id' => $candidate->id,
            'email' => 'candidate@example.com',
            'role' => 'candidate',
            'must_change_password' => true,
        ]);

        Mail::assertSent(CandidateInvitationMail::class, function (CandidateInvitationMail $mail) {
            return $mail->user->email === 'candidate@example.com'
                && $mail->temporaryPassword === 'Candidate!123';
        });
    }

    public function test_admin_can_update_candidate_and_keep_linked_user_in_sync(): void
    {
        Mail::fake();

        $admin = Admin::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'phone' => '97000000',
            'password' => Hash::make('AdminPass!123'),
            'role' => 'admin',
            'status' => 'active',
        ]);
        $category = Category::create([
            'name' => 'Miss',
            'slug' => 'miss',
            'description' => 'Miss',
            'status' => 'active',
            'position' => 1,
        ]);
        $candidate = Candidate::factory()->create([
            'category_id' => $category->id,
            'first_name' => 'Aicha',
            'last_name' => 'Kouassi',
            'email' => 'candidate@example.com',
            'city' => 'Cotonou',
            'status' => 'active',
            'is_active' => true,
        ]);
        User::factory()->create([
            'candidate_id' => $candidate->id,
            'email' => 'candidate@example.com',
            'role' => 'candidate',
            'status' => 'active',
            'password' => Hash::make('Candidate!123'),
        ]);

        Sanctum::actingAs($admin, ['admin']);

        $response = $this->putJson("/api/admin/candidates/{$candidate->id}", [
            'category_id' => $category->id,
            'first_name' => 'Aya',
            'last_name' => 'Kouassi',
            'email' => 'candidate.updated@example.com',
            'description' => 'Candidate mise a jour',
            'city' => 'Porto-Novo',
            'university' => 'UAC',
            'age' => 24,
            'status' => 'inactive',
            'is_active' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('candidate.first_name', 'Aya')
            ->assertJsonPath('candidate.email', 'candidate.updated@example.com')
            ->assertJsonPath('candidate.status', 'inactive');

        $this->assertDatabaseHas('candidates', [
            'id' => $candidate->id,
            'first_name' => 'Aya',
            'email' => 'candidate.updated@example.com',
            'city' => 'Porto-Novo',
            'status' => 'inactive',
            'is_active' => false,
        ]);

        $this->assertDatabaseHas('users', [
            'candidate_id' => $candidate->id,
            'email' => 'candidate.updated@example.com',
            'status' => 'inactive',
        ]);
    }

    public function test_candidate_must_change_password_before_dashboard_and_receives_confirmation_email(): void
    {
        Mail::fake();

        $category = Category::create([
            'name' => 'Mister',
            'slug' => 'mister',
            'description' => 'Mister',
            'status' => 'active',
            'position' => 2,
        ]);
        $candidate = Candidate::factory()->create([
            'category_id' => $category->id,
            'email' => 'candidate2@example.com',
            'status' => 'active',
            'is_active' => true,
        ]);
        $user = User::factory()->create([
            'candidate_id' => $candidate->id,
            'email' => 'candidate2@example.com',
            'role' => 'candidate',
            'status' => 'active',
            'password' => Hash::make('TempPass!123'),
            'must_change_password' => true,
        ]);

        Sanctum::actingAs($user, ['candidate']);

        $this->getJson('/api/candidate/dashboard')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Password change required');

        $changeResponse = $this->postJson('/api/auth/change-password', [
            'current_password' => 'TempPass!123',
            'password' => 'NewSecure!123',
            'password_confirmation' => 'NewSecure!123',
        ]);

        $changeResponse->assertOk()
            ->assertJsonPath('user.role', 'candidate')
            ->assertJsonPath('user.must_change_password', false)
            ->assertJsonStructure(['token']);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'must_change_password' => false,
        ]);

        Mail::assertSent(PasswordChangedConfirmationMail::class, function (PasswordChangedConfirmationMail $mail) {
            return $mail->user->email === 'candidate2@example.com';
        });

        Sanctum::actingAs($user->fresh(), ['candidate']);

        $this->getJson('/api/candidate/dashboard')
            ->assertOk()
            ->assertJsonPath('candidate.id', $candidate->id);
    }
}
