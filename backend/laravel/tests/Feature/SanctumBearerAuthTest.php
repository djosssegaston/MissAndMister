<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use App\Services\ClassementPdfExportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Mockery;
use Tests\TestCase;

class SanctumBearerAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_sanctum_configuration_uses_bearer_tokens_without_session_guards(): void
    {
        $this->assertSame([], config('sanctum.guard'));
    }

    public function test_protected_api_route_returns_401_without_token(): void
    {
        $this->getJson('/api/me')
            ->assertStatus(401)
            ->assertJson([
                'message' => 'Unauthenticated',
            ]);
    }

    public function test_protected_api_route_returns_401_without_token_even_without_json_accept_header(): void
    {
        $this->get('/api/me')
            ->assertStatus(401)
            ->assertJson([
                'message' => 'Unauthenticated',
            ]);
    }

    public function test_vercel_preview_origin_is_allowed_for_api_cors_preflight(): void
    {
        $this->call('OPTIONS', '/api/auth/login', [], [], [], [
            'HTTP_ORIGIN' => 'https://miss-and-mister-preview-test.vercel.app',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,accept,authorization',
        ])
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'https://miss-and-mister-preview-test.vercel.app')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_user_can_access_api_me_with_bearer_token(): void
    {
        $user = User::factory()->create([
            'email' => 'user@example.com',
            'password' => Hash::make('Secret123!'),
            'role' => 'user',
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $token = $user->createToken('auth_token', ['user'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJson([
                'id' => $user->id,
                'email' => $user->email,
                'role' => 'user',
            ]);
    }

    public function test_admin_can_access_admin_route_with_bearer_token(): void
    {
        $admin = Admin::query()->create([
            'name' => 'Admin Principal',
            'email' => 'admin@example.com',
            'phone' => '+22901020304',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $token = $admin->createToken('admin_token', ['admin'])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/admin/categories')
            ->assertOk();
    }

    public function test_admin_bearer_token_can_access_test_pdf_auth_route(): void
    {
        $admin = Admin::query()->create([
            'name' => 'Admin Principal',
            'email' => 'admin@example.com',
            'phone' => '+22901020304',
            'password' => Hash::make('Secret123!'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $tempDirectory = storage_path('app/testing/sanctum-pdf-auth-' . uniqid('', true));
        File::ensureDirectoryExists($tempDirectory);
        $pdfPath = $tempDirectory . DIRECTORY_SEPARATOR . 'classement_miss_2026.pdf';
        file_put_contents($pdfPath, '%PDF-1.4 test');

        $service = Mockery::mock(ClassementPdfExportService::class);
        $service->shouldReceive('createSingleCategoryPdf')
            ->once()
            ->with('Miss')
            ->andReturn([
                'pdf_path' => $pdfPath,
                'download_name' => 'classement_miss_2026.pdf',
                'temp_directory' => $tempDirectory,
                'category' => 'Miss',
            ]);
        $service->shouldReceive('cleanupExportArtifacts')
            ->zeroOrMoreTimes();
        $this->app->instance(ClassementPdfExportService::class, $service);

        $token = $admin->createToken('admin_token', ['admin'])->plainTextToken;
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->get('/api/test-pdf-auth?category=Miss');

        try {
            $response
                ->assertOk()
                ->assertDownload('classement_miss_2026.pdf')
                ->assertHeader('content-type', 'application/pdf');
        } finally {
            File::deleteDirectory($tempDirectory);
        }
    }
}
