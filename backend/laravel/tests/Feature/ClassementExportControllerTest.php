<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Services\ClassementPdfExportService;
use Illuminate\Support\Facades\File;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;
use ZipArchive;

class ClassementExportControllerTest extends TestCase
{
    public function test_export_route_requires_authentication(): void
    {
        $this->getJson('/api/admin/export-classement-pdf')
            ->assertStatus(401);
    }

    public function test_test_pdf_auth_route_requires_authentication(): void
    {
        $this->getJson('/api/test-pdf-auth?category=Miss')
            ->assertStatus(401);
    }

    public function test_export_route_requires_admin_ability(): void
    {
        Sanctum::actingAs(new Admin([
            'name' => 'Simple User',
            'email' => 'user@example.com',
            'role' => 'user',
            'status' => 'active',
        ]), ['user']);

        $this->getJson('/api/admin/export-classement-pdf')
            ->assertStatus(403);
    }

    public function test_export_route_returns_zip_download_for_admin(): void
    {
        Sanctum::actingAs(new Admin([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]), ['admin']);

        $tempDirectory = storage_path('app/testing/classement-export-' . uniqid('', true));
        File::ensureDirectoryExists($tempDirectory);
        $zipPath = $tempDirectory . DIRECTORY_SEPARATOR . 'classement_miss_mister_2026.zip';
        $this->createZipFixture($zipPath);

        $service = Mockery::mock(ClassementPdfExportService::class);
        $service->shouldReceive('createClassementZip')
            ->once()
            ->andReturn([
                'zip_path' => $zipPath,
                'download_name' => 'classement_miss_mister_2026.zip',
                'temp_directory' => $tempDirectory,
            ]);
        $service->shouldReceive('cleanupExportArtifacts')
            ->zeroOrMoreTimes();
        $this->app->instance(ClassementPdfExportService::class, $service);

        $response = $this->get('/api/admin/export-classement-pdf');

        try {
            $response
                ->assertOk()
                ->assertDownload('classement_miss_mister_2026.zip')
                ->assertHeader('content-type', 'application/zip');
        } finally {
            File::deleteDirectory($tempDirectory);
        }
    }

    public function test_export_route_returns_json_error_when_generation_fails(): void
    {
        Sanctum::actingAs(new Admin([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]), ['admin']);

        $service = Mockery::mock(ClassementPdfExportService::class);
        $service->shouldReceive('createClassementZip')
            ->once()
            ->andThrow(new \RuntimeException('PDF generation failed'));
        $service->shouldReceive('cleanupExportArtifacts')
            ->zeroOrMoreTimes();
        $this->app->instance(ClassementPdfExportService::class, $service);

        $this->getJson('/api/admin/export-classement-pdf')
            ->assertStatus(500)
            ->assertJson([
                'message' => 'Impossible de générer le classement PDF pour le moment.',
            ]);
    }

    public function test_isolated_test_pdf_route_returns_pdf_download_for_admin(): void
    {
        Sanctum::actingAs(new Admin([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'status' => 'active',
        ]), ['admin']);

        $tempDirectory = storage_path('app/testing/classement-test-pdf-' . uniqid('', true));
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

        $response = $this->get('/api/test-pdf-auth?category=Miss');

        try {
            $response
                ->assertOk()
                ->assertDownload('classement_miss_2026.pdf')
                ->assertHeader('content-type', 'application/pdf');
        } finally {
            File::deleteDirectory($tempDirectory);
        }
    }

    public function test_test_pdf_auth_route_requires_admin_role(): void
    {
        Sanctum::actingAs(new Admin([
            'name' => 'Simple User',
            'email' => 'user@example.com',
            'role' => 'user',
            'status' => 'active',
        ]), ['user']);

        $this->getJson('/api/test-pdf-auth?category=Miss')
            ->assertStatus(403)
            ->assertJson([
                'message' => 'Forbidden',
            ]);
    }

    private function createZipFixture(string $zipPath): void
    {
        $zip = new ZipArchive();
        $opened = $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        if ($opened !== true) {
            throw new \RuntimeException('Unable to create ZIP test fixture.');
        }

        $zip->addFromString('classement_miss_2026.pdf', '%PDF-1.4 miss');
        $zip->addFromString('classement_mister_2026.pdf', '%PDF-1.4 mister');
        $zip->close();
    }
}
