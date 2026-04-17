<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
}
