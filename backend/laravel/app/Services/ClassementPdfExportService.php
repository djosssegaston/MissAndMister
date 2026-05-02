<?php

namespace App\Services;

use App\Repositories\CandidateRepository;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use PharData;
use ZipArchive;

class ClassementPdfExportService
{
    private const EDITION_LABEL = '1ère Édition 2026';
    private const SUBTITLE = 'Tendance des votes & classement - présélection';
    private const SIGNATORY = 'Delphin DOSSA EZOUN-AGNAN';
    private const PERCENTAGE_CAP = 40.0;
    private const PERCENTAGE_THRESHOLD_VOTES = 200;
    private const TEMP_ROOT = 'app/tmp/classement-exports';
    private const DOMPDF_TEMP_ROOT = 'app/tmp/dompdf';
    private const DOMPDF_FONT_ROOT = 'app/tmp/dompdf-fonts';

    public function __construct(
        private CandidateRepository $candidates,
    ) {
    }

    public function buildClassement(string $categoryName): Collection
    {
        return $this->candidates->listPublic($categoryName)
            ->map(function ($candidate) {
                $votes = max(0, (int) ($candidate->votes_count ?? 0));
                $fullName = $this->normalizeWhitespace(trim(implode(' ', array_filter([
                    $candidate->last_name ?? '',
                    $candidate->first_name ?? '',
                ], static fn ($value) => trim((string) $value) !== ''))));

                return [
                    'candidate_id' => (int) $candidate->id,
                    'full_name' => $fullName !== '' ? $fullName : 'Candidat sans nom',
                    'university' => $this->normalizeWhitespace((string) ($candidate->university ?? '')) ?: '—',
                    'votes' => $votes,
                    'percentage' => $this->calculatePercentage($votes),
                    'public_number' => $candidate->public_number !== null ? (int) $candidate->public_number : null,
                    'category' => $candidate->category?->name ?? $categoryName,
                ];
            })
            ->sort(function (array $left, array $right): int {
                if ($left['votes'] !== $right['votes']) {
                    return $right['votes'] <=> $left['votes'];
                }

                $leftNumber = $left['public_number'] ?? PHP_INT_MAX;
                $rightNumber = $right['public_number'] ?? PHP_INT_MAX;

                if ($leftNumber !== $rightNumber) {
                    return $leftNumber <=> $rightNumber;
                }

                return strcasecmp($left['full_name'], $right['full_name']);
            })
            ->values()
            ->map(function (array $row, int $index): array {
                $row['rank'] = $index + 1;

                return $row;
            });
    }

    public function calculatePercentage(int|float $votes): float
    {
        $safeVotes = max(0, (float) $votes);

        if ($safeVotes >= self::PERCENTAGE_THRESHOLD_VOTES) {
            return self::PERCENTAGE_CAP;
        }

        return round(($safeVotes / self::PERCENTAGE_THRESHOLD_VOTES) * self::PERCENTAGE_CAP, 2);
    }

    public function generateCategoryPdf(string $categoryName): string
    {
        try {
            $rows = $this->buildClassement($categoryName);
            $dompdfTempDir = $this->ensureWritableDirectory(storage_path(self::DOMPDF_TEMP_ROOT));
            $dompdfFontDir = $this->ensureWritableDirectory(storage_path(self::DOMPDF_FONT_ROOT));

            logger()->info('Classement PDF category generation started', [
                'category' => $categoryName,
                'rows_count' => $rows->count(),
                'dompdf_temp_dir' => $dompdfTempDir,
                'dompdf_font_dir' => $dompdfFontDir,
            ]);

            $pdf = $this->withPdfRuntimeTuning(function () use ($rows, $categoryName, $dompdfTempDir, $dompdfFontDir) {
                return Pdf::setOption(array_merge(config('dompdf.options', []), [
                    'defaultFont' => 'DejaVu Sans',
                    'dpi' => 144,
                    'isPhpEnabled' => false,
                    'isRemoteEnabled' => true,
                    'isJavascriptEnabled' => false,
                    'isHtml5ParserEnabled' => true,
                    'tempDir' => $dompdfTempDir,
                    'fontDir' => $dompdfFontDir,
                    'fontCache' => $dompdfFontDir,
                    'chroot' => base_path(),
                ]))->loadView('pdf.classement', $this->buildPdfViewPayload($categoryName, $rows))
                    ->setPaper('a4', 'portrait');
            });

            return $pdf->output();
        } catch (\Throwable $exception) {
            throw new \RuntimeException(
                sprintf('Impossible de générer le PDF de classement pour la catégorie %s.', $categoryName),
                previous: $exception,
            );
        }
    }

    public function createClassementZip(): array
    {
        $tempRoot = $this->ensureWritableDirectory(storage_path(self::TEMP_ROOT));
        $tempDirectory = $this->ensureWritableDirectory($tempRoot . DIRECTORY_SEPARATOR . Str::ulid());

        $zipPath = $tempDirectory . DIRECTORY_SEPARATOR . 'classement_miss_mister_2026.zip';
        $pdfPaths = [];

        logger()->info('Classement PDF export zip build started', [
            'temp_directory' => $tempDirectory,
        ]);

        try {
            foreach ([
                'Miss' => 'classement_miss_2026.pdf',
                'Mister' => 'classement_mister_2026.pdf',
            ] as $categoryName => $filename) {
                $pdfPath = $tempDirectory . DIRECTORY_SEPARATOR . $filename;
                $this->writeFileOrFail($pdfPath, $this->generateCategoryPdf($categoryName));
                $pdfPaths[$filename] = $pdfPath;
            }

            $this->createZipArchive($zipPath, $pdfPaths);
        } catch (\Throwable $exception) {
            $this->cleanupExportArtifacts($tempDirectory);
            throw $exception;
        }

        logger()->info('Classement PDF export zip build completed', [
            'zip_path' => $zipPath,
            'files' => array_keys($pdfPaths),
        ]);

        return [
            'zip_path' => $zipPath,
            'download_name' => 'classement_miss_mister_2026.zip',
            'temp_directory' => $tempDirectory,
        ];
    }

    public function createSingleCategoryPdf(string $categoryName): array
    {
        $normalizedCategory = $this->normalizeCategoryName($categoryName);
        $tempRoot = $this->ensureWritableDirectory(storage_path(self::TEMP_ROOT));
        $tempDirectory = $this->ensureWritableDirectory($tempRoot . DIRECTORY_SEPARATOR . Str::ulid());
        $filename = sprintf('classement_%s_2026.pdf', strtolower($normalizedCategory));
        $pdfPath = $tempDirectory . DIRECTORY_SEPARATOR . $filename;

        try {
            $this->writeFileOrFail($pdfPath, $this->generateCategoryPdf($normalizedCategory));
        } catch (\Throwable $exception) {
            $this->cleanupExportArtifacts($tempDirectory);
            throw $exception;
        }

        return [
            'pdf_path' => $pdfPath,
            'download_name' => $filename,
            'temp_directory' => $tempDirectory,
            'category' => $normalizedCategory,
        ];
    }

    public function cleanupExportArtifacts(?string $tempDirectory): void
    {
        if (!$tempDirectory || !is_dir($tempDirectory)) {
            return;
        }

        File::deleteDirectory($tempDirectory);
    }

    public function runtimeDiagnostics(): array
    {
        $storageRoot = storage_path();
        $tempRoot = storage_path(self::TEMP_ROOT);
        $dompdfTempRoot = storage_path(self::DOMPDF_TEMP_ROOT);
        $dompdfFontRoot = storage_path(self::DOMPDF_FONT_ROOT);
        $bootstrapCache = base_path('bootstrap/cache');

        return [
            'php_version' => PHP_VERSION,
            'memory_limit' => (string) ini_get('memory_limit'),
            'max_execution_time' => (string) ini_get('max_execution_time'),
            'ziparchive_available' => class_exists(ZipArchive::class),
            'phardata_available' => class_exists(PharData::class),
            'phar_readonly' => (string) ini_get('phar.readonly'),
            'storage_writable' => is_dir($storageRoot) && is_writable($storageRoot),
            'bootstrap_cache_writable' => is_dir($bootstrapCache) && is_writable($bootstrapCache),
            'temp_root' => $tempRoot,
            'temp_root_exists' => is_dir($tempRoot),
            'temp_root_writable' => is_dir($tempRoot) && is_writable($tempRoot),
            'dompdf_temp_root' => $dompdfTempRoot,
            'dompdf_temp_root_exists' => is_dir($dompdfTempRoot),
            'dompdf_temp_root_writable' => is_dir($dompdfTempRoot) && is_writable($dompdfTempRoot),
            'dompdf_font_root' => $dompdfFontRoot,
            'dompdf_font_root_exists' => is_dir($dompdfFontRoot),
            'dompdf_font_root_writable' => is_dir($dompdfFontRoot) && is_writable($dompdfFontRoot),
            'logo_data_uri_available' => $this->resolveLogoDataUri() !== null,
            'dompdf_config_present' => config()->has('dompdf.options'),
        ];
    }

    public function buildPdfViewPayload(string $categoryName, Collection $rows): array
    {
        return [
            'categoryName' => strtoupper($categoryName),
            'editionLabel' => self::EDITION_LABEL,
            'subtitle' => self::SUBTITLE,
            'rows' => $rows,
            'generatedAt' => now(),
            'signatory' => self::SIGNATORY,
            'logoDataUri' => $this->resolveLogoDataUri(),
        ];
    }

    private function resolveLogoDataUri(): ?string
    {
        $candidates = [
            public_path('branding/mmub-logo.jpeg'),
            public_path('branding/mmub-logo.jpg'),
            base_path('../../frontend/missandmisterfront/src/assets/logo.jpeg'),
        ];

        foreach ($candidates as $path) {
            if (!is_file($path)) {
                continue;
            }

            $contents = @file_get_contents($path);
            if ($contents === false) {
                continue;
            }

            $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mimeType = $extension === 'png' ? 'image/png' : 'image/jpeg';

            return 'data:' . $mimeType . ';base64,' . base64_encode($contents);
        }

        return null;
    }

    private function normalizeWhitespace(string $value): string
    {
        $normalized = preg_replace('/\s+/u', ' ', trim($value));

        return is_string($normalized) ? $normalized : trim($value);
    }

    private function ensureWritableDirectory(string $path): string
    {
        File::ensureDirectoryExists($path);

        if (!is_dir($path)) {
            throw new \RuntimeException(sprintf('Le dossier temporaire %s est introuvable.', $path));
        }

        if (!is_writable($path)) {
            throw new \RuntimeException(sprintf('Le dossier temporaire %s n’est pas accessible en écriture.', $path));
        }

        return $path;
    }

    private function writeFileOrFail(string $path, string $binaryContent): void
    {
        $writtenBytes = @file_put_contents($path, $binaryContent);

        if ($writtenBytes === false) {
            throw new \RuntimeException(sprintf('Impossible d’écrire le fichier temporaire %s.', basename($path)));
        }
    }

    private function createZipArchive(string $zipPath, array $pdfPaths): void
    {
        if (class_exists(ZipArchive::class)) {
            $zip = new ZipArchive();
            $opened = $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

            if ($opened === true) {
                foreach ($pdfPaths as $filename => $path) {
                    if (!$zip->addFile($path, $filename)) {
                        $zip->close();
                        throw new \RuntimeException(sprintf('Impossible d’ajouter %s dans l’archive ZIP.', $filename));
                    }
                }

                $zip->close();

                return;
            }
        }

        if (!class_exists(PharData::class)) {
            throw new \RuntimeException('Aucun moteur ZIP compatible n’est disponible sur le serveur.');
        }

        try {
            @unlink($zipPath);
            $archive = new PharData($zipPath);

            foreach ($pdfPaths as $filename => $path) {
                $archive->addFile($path, $filename);
            }
        } catch (\Throwable $exception) {
            throw new \RuntimeException('Impossible de créer l’archive ZIP des classements.', previous: $exception);
        }
    }

    private function normalizeCategoryName(string $categoryName): string
    {
        $normalized = strtolower(trim($categoryName));

        return $normalized === 'mister' ? 'Mister' : 'Miss';
    }

    private function withPdfRuntimeTuning(callable $callback)
    {
        $targets = [
            'memory_limit' => env('PDF_MEMORY_LIMIT', '512M'),
            'max_execution_time' => (string) env('PDF_MAX_EXECUTION_TIME', '120'),
        ];

        $originals = [];

        foreach ($targets as $key => $value) {
            $originals[$key] = ini_get($key);
            @ini_set($key, (string) $value);
        }

        try {
            return $callback();
        } finally {
            foreach ($originals as $key => $value) {
                if ($value !== false) {
                    @ini_set($key, (string) $value);
                }
            }
        }
    }
}
