<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_login_revokes_previous_tokens(): void
    {
        $user = User::factory()->create([
            'email' => 'user@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
            'status' => 'active',
        ]);

        $firstLogin = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Secret123!',
        ])->assertOk();

        $firstToken = $firstLogin->json('token');

        $secondLogin = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Secret123!',
        ])->assertOk();

        $secondToken = $secondLogin->json('token');

        $this->assertNotSame($firstToken, $secondToken);
        $this->assertNull(PersonalAccessToken::findToken($firstToken));
        $this->assertNotNull(PersonalAccessToken::findToken($secondToken));
        $this->assertSame(1, $user->fresh()->tokens()->count());
    }

    public function test_admin_login_revokes_previous_tokens(): void
    {
        $admin = Admin::query()->create([
            'name' => 'Admin Principal',
            'email' => 'admin@example.com',
            'phone' => '+22901020304',
            'password' => Hash::make('Secret123!'),
            'role' => 'superadmin',
            'status' => 'active',
        ]);

        $firstLogin = $this->postJson('/api/auth/login', [
            'email' => $admin->email,
            'password' => 'Secret123!',
            'scope' => 'admin',
        ])->assertOk();

        $firstToken = $firstLogin->json('token');

        $secondLogin = $this->postJson('/api/auth/login', [
            'email' => $admin->email,
            'password' => 'Secret123!',
            'scope' => 'admin',
        ])->assertOk();

        $secondToken = $secondLogin->json('token');

        $this->assertNotSame($firstToken, $secondToken);
        $this->assertNull(PersonalAccessToken::findToken($firstToken));
        $this->assertNotNull(PersonalAccessToken::findToken($secondToken));
        $this->assertSame(1, $admin->fresh()->tokens()->count());
    }

    public function test_admin_login_missing_credentials_returns_validation_error(): void
    {
        $this->postJson('/api/auth/admin-login', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_admin_login_syncs_configured_accounts_before_authentication(): void
    {
        config()->set('admin.accounts', [[
            'name' => 'Configured Admin',
            'email' => 'configured-admin@example.com',
            'phone' => '+22999999999',
            'password' => 'Secret123!',
            'role' => 'superadmin',
            'status' => 'active',
        ]]);

        $response = $this->postJson('/api/auth/admin-login', [
            'email' => 'configured-admin@example.com',
            'password' => 'Secret123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'configured-admin@example.com')
            ->assertJsonPath('user.role', 'superadmin');

        $this->assertDatabaseHas('admins', [
            'email' => 'configured-admin@example.com',
            'role' => 'superadmin',
            'status' => 'active',
        ]);
    }

    public function test_admin_login_falls_back_when_personal_access_tokens_expires_at_column_is_missing(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table): void {
            $table->dropColumn('expires_at');
        });

        $admin = Admin::query()->create([
            'name' => 'Legacy Admin',
            'email' => 'legacy-admin@example.com',
            'phone' => '+22901020305',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/auth/admin-login', [
            'email' => $admin->email,
            'password' => 'Secret123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'legacy-admin@example.com')
            ->assertJsonPath('user.role', 'admin');
    }
}
