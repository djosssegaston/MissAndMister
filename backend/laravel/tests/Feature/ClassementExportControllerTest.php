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
