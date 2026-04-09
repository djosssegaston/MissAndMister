<?php

namespace Tests\Feature;

use App\Contracts\CandidateFaceDetector;
use App\Jobs\ProcessCandidateImage;
use App\Models\Admin;
use App\Models\Candidate;
use App\Models\Category;
use App\Services\CandidateImages\CandidateImagePipeline;
use App\Support\CandidateFaceBox;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CandidateImagePipelineTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'filesystems.disks.public.root' => storage_path('framework/testing/disks/public'),
            'candidate_images.disk' => 'public',
            'candidate_images.blur_threshold' => 0,
            'candidate_images.require_face_detection' => true,
            'candidate_images.async_processing' => false,
        ]);
    }

    public function test_admin_photo_upload_rejects_images_below_minimum_width(): void
    {
        Storage::fake('public');
        Queue::fake();

        $this->bindFaceDetector();
        $admin = $this->createAdmin();
        $candidate = $this->createCandidate();

        Sanctum::actingAs($admin, ['admin']);

        $response = $this
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/candidates/{$candidate->id}/photo", [
                'photo' => UploadedFile::fake()->image('tiny.jpg', 400, 400),
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('photo');

        Queue::assertNothingPushed();
        $this->assertNull($candidate->fresh()->photo_original_path);
    }

    public function test_admin_photo_upload_queues_processing_and_marks_candidate_as_queued(): void
    {
        Storage::fake('public');
        Queue::fake();
        config([
            'candidate_images.async_processing' => true,
        ]);

        $this->bindFaceDetector();
        $admin = $this->createAdmin();
        $candidate = $this->createCandidate();

        Sanctum::actingAs($admin, ['admin']);

        $response = $this
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/candidates/{$candidate->id}/photo", [
                'photo' => UploadedFile::fake()->image('candidate.jpg', 1200, 900),
            ]);

        $response->assertStatus(202)
            ->assertJsonPath('processing', true)
            ->assertJsonPath('candidate.photo_processing_status', 'queued');

        $candidate->refresh();

        $this->assertSame('queued', $candidate->photo_processing_status);
        $this->assertNotNull($candidate->photo_original_path);
        Storage::disk('public')->assertExists($candidate->photo_original_path);
        Queue::assertPushed(ProcessCandidateImage::class);
    }

    public function test_admin_photo_upload_processes_immediately_when_async_processing_is_disabled(): void
    {
        Storage::fake('public');

        $this->bindFaceDetector();
        $admin = $this->createAdmin();
        $candidate = $this->createCandidate();

        Sanctum::actingAs($admin, ['admin']);

        $response = $this
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/candidates/{$candidate->id}/photo", [
                'photo' => UploadedFile::fake()->image('candidate.jpg', 1200, 900),
            ]);

        $response->assertOk()
            ->assertJsonPath('processing', false)
            ->assertJsonPath('candidate.photo_processing_status', 'ready')
            ->assertJsonPath('success', true);

        $candidate->refresh();

        $this->assertSame('ready', $candidate->photo_processing_status);
        $this->assertNotNull($candidate->photo_path);
        Storage::disk('public')->assertExists($candidate->photo_variants['large']);
    }

    public function test_admin_photo_upload_falls_back_when_face_detector_is_unavailable(): void
    {
        Storage::fake('public');
        config([
            'candidate_images.require_face_detection' => false,
        ]);

        $this->app->instance(CandidateFaceDetector::class, new class implements CandidateFaceDetector
        {
            public function detect(string $absolutePath): ?CandidateFaceBox
            {
                throw new \RuntimeException('Service de detection indisponible.');
            }
        });

        $admin = $this->createAdmin();
        $candidate = $this->createCandidate();

        Sanctum::actingAs($admin, ['admin']);

        $response = $this
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/candidates/{$candidate->id}/photo", [
                'photo' => UploadedFile::fake()->image('candidate.jpg', 1200, 900),
            ]);

        $response->assertOk()
            ->assertJsonPath('processing', false)
            ->assertJsonPath('candidate.photo_processing_status', 'ready')
            ->assertJsonPath('candidate.photo_meta.face_detection_error', 'Service de detection indisponible.');
    }

    public function test_processing_job_generates_webp_variants_and_updates_candidate(): void
    {
        Storage::fake('public');

        $face = new CandidateFaceBox(320, 140, 240, 240, 99.0);
        $this->bindFaceDetector($face);

        $candidate = $this->createCandidate([
            'photo_processing_status' => 'queued',
        ]);

        $originalPath = UploadedFile::fake()->image('candidate.jpg', 1200, 900)
            ->store('candidate-images/originals', 'public');

        $candidate->forceFill([
            'photo_original_path' => $originalPath,
            'photo_meta' => [
                'face' => $face->toArray(),
            ],
        ])->save();

        $job = new ProcessCandidateImage($candidate->id, $originalPath);
        $job->handle(app(CandidateImagePipeline::class));

        $candidate->refresh();

        $this->assertSame('ready', $candidate->photo_processing_status);
        $this->assertNotNull($candidate->photo_path);
        $this->assertSame($candidate->photo_variants['large'] ?? null, $candidate->photo_path);
        $this->assertArrayHasKey('thumbnail', $candidate->photo_urls);
        $this->assertArrayHasKey('medium', $candidate->photo_urls);
        $this->assertArrayHasKey('large', $candidate->photo_urls);

        Storage::disk('public')->assertExists($candidate->photo_variants['thumbnail']);
        Storage::disk('public')->assertExists($candidate->photo_variants['medium']);
        Storage::disk('public')->assertExists($candidate->photo_variants['large']);
    }

    private function createAdmin(): Admin
    {
        return Admin::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'phone' => '97000000',
            'password' => Hash::make('AdminPass!123'),
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function createCandidate(array $overrides = []): Candidate
    {
        $category = Category::firstOrCreate(
            ['slug' => 'miss'],
            ['name' => 'Miss', 'description' => 'Miss', 'status' => 'active', 'position' => 1]
        );

        return Candidate::factory()->create(array_merge([
            'category_id' => $category->id,
        ], $overrides));
    }

    private function bindFaceDetector(?CandidateFaceBox $face = null): void
    {
        $face ??= new CandidateFaceBox(280, 120, 220, 220, 99.0);

        $this->app->instance(CandidateFaceDetector::class, new class($face) implements CandidateFaceDetector
        {
            public function __construct(private readonly ?CandidateFaceBox $face)
            {
            }

            public function detect(string $absolutePath): ?CandidateFaceBox
            {
                return $this->face;
            }
        });
    }
}
