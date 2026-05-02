<?php

namespace Tests\Unit;

use App\Repositories\CandidateRepository;
use App\Services\ClassementPdfExportService;
use Illuminate\Database\Eloquent\Collection;
use Mockery;
use Tests\TestCase;
use ZipArchive;

class ClassementPdfExportServiceTest extends TestCase
{
    public function test_build_classement_maps_candidates_sorts_by_votes_and_assigns_rank(): void
    {
        $repository = Mockery::mock(CandidateRepository::class);
        $repository->shouldReceive('listPublic')
            ->once()
            ->with('Miss')
            ->andReturn(new Collection([
                $this->candidate([
                    'id' => 14,
                    'first_name' => 'Awa',
                    'last_name' => 'Kossi',
                    'public_number' => 12,
                    'university' => 'UAC',
                    'votes_count' => 150,
                    'category_name' => 'Miss',
                ]),
                $this->candidate([
                    'id' => 7,
                    'first_name' => 'Maya',
                    'last_name' => 'Adje',
                    'public_number' => 5,
                    'university' => 'ENEAM',
                    'votes_count' => 250,
                    'category_name' => 'Miss',
                ]),
                $this->candidate([
                    'id' => 11,
                    'first_name' => 'Lina',
                    'last_name' => 'Assogba',
                    'public_number' => 9,
                    'university' => 'UP',
                    'votes_count' => 250,
                    'category_name' => 'Miss',
                ]),
            ]));

        $service = new ClassementPdfExportService($repository);
        $classement = $service->buildClassement('Miss');

        $this->assertCount(3, $classement);
        $this->assertSame([7, 11, 14], $classement->pluck('candidate_id')->all());
        $this->assertSame([1, 2, 3], $classement->pluck('rank')->all());
        $this->assertSame('Adje Maya', $classement[0]['full_name']);
        $this->assertSame('ENEAM', $classement[0]['university']);
        $this->assertSame('Miss', $classement[0]['category']);
        $this->assertSame(40.0, $classement[0]['percentage']);
        $this->assertSame(30.0, $classement[2]['percentage']);
    }

    public function test_calculate_percentage_caps_and_rounds(): void
    {
        $service = new ClassementPdfExportService(Mockery::mock(CandidateRepository::class));

        $this->assertSame(40.0, $service->calculatePercentage(200));
        $this->assertSame(40.0, $service->calculatePercentage(480));
        $this->assertSame(2.47, $service->calculatePercentage(12.345));
    }

    public function test_generate_category_pdf_returns_a_pdf_binary(): void
    {
        $repository = Mockery::mock(CandidateRepository::class);
        $repository->shouldReceive('listPublic')
            ->once()
            ->with('Miss')
            ->andReturn(new Collection([
                $this->candidate([
                    'id' => 5,
                    'first_name' => 'Nadia',
                    'last_name' => 'Ahouansou',
                    'public_number' => 3,
                    'university' => 'UAC',
                    'votes_count' => 99,
                    'category_name' => 'Miss',
                ]),
            ]));

        $service = new ClassementPdfExportService($repository);
        $pdfBinary = $service->generateCategoryPdf('Miss');

        $this->assertNotEmpty($pdfBinary);
        $this->assertStringStartsWith('%PDF', $pdfBinary);
    }

    public function test_create_classement_zip_contains_the_two_expected_pdfs(): void
    {
        $repository = Mockery::mock(CandidateRepository::class);
        $repository->shouldReceive('listPublic')
            ->twice()
            ->andReturnUsing(function (string $categoryName): Collection {
                return new Collection([
                    $this->candidate([
                        'id' => $categoryName === 'Miss' ? 3 : 8,
                        'first_name' => $categoryName === 'Miss' ? 'Nadia' : 'Marc',
                        'last_name' => $categoryName === 'Miss' ? 'Ahouansou' : 'Dossou',
                        'public_number' => 1,
                        'university' => 'UAC',
                        'votes_count' => 210,
                        'category_name' => $categoryName,
                    ]),
                ]);
            });

        $service = new ClassementPdfExportService($repository);
        $export = $service->createClassementZip();

        try {
            $this->assertFileExists($export['zip_path']);
            $this->assertSame('classement_miss_mister_2026.zip', $export['download_name']);

            $zip = new ZipArchive();
            $opened = $zip->open($export['zip_path']);

            $this->assertTrue($opened === true);

            $entries = [];
            for ($index = 0; $index < $zip->numFiles; $index++) {
                $entries[] = $zip->getNameIndex($index);
            }

            $this->assertContains('classement_miss_2026.pdf', $entries);
            $this->assertContains('classement_mister_2026.pdf', $entries);

            $missPdf = $zip->getFromName('classement_miss_2026.pdf');
            $misterPdf = $zip->getFromName('classement_mister_2026.pdf');
            $zip->close();

            $this->assertIsString($missPdf);
            $this->assertIsString($misterPdf);
            $this->assertStringStartsWith('%PDF', $missPdf);
            $this->assertStringStartsWith('%PDF', $misterPdf);
        } finally {
            $service->cleanupExportArtifacts($export['temp_directory'] ?? null);
        }
    }

    private function candidate(array $overrides = []): object
    {
        return (object) array_merge([
            'id' => 1,
            'first_name' => 'Awa',
            'last_name' => 'Kossi',
            'public_number' => 1,
            'university' => 'UAC',
            'votes_count' => 0,
            'category' => (object) [
                'name' => $overrides['category_name'] ?? 'Miss',
            ],
        ], $overrides);
    }
}
