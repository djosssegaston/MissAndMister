<?php

namespace App\Services;

use App\Repositories\CandidateRepository;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use ZipArchive;

class ClassementPdfExportService
{
    private const EDITION_LABEL = '1ère Édition 2026';
    private const SUBTITLE = 'Tendance des votes & classement - présélection';
    private const SIGNATORY = 'Delphin DOSSA EZOUN-AGNAN';
    private const PERCENTAGE_CAP = 40.0;
    private const PERCENTAGE_THRESHOLD_VOTES = 200;

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

            $pdf = Pdf::setOption([
                'defaultFont' => 'DejaVu Sans',
                'dpi' => 144,
                'isPhpEnabled' => false,
                'isRemoteEnabled' => false,
                'isJavascriptEnabled' => false,
                'isHtml5ParserEnabled' => true,
            ])->loadView('pdf.classement', [
                'categoryName' => strtoupper($categoryName),
                'editionLabel' => self::EDITION_LABEL,
                'subtitle' => self::SUBTITLE,
                'rows' => $rows,
                'generatedAt' => now(),
                'signatory' => self::SIGNATORY,
                'logoDataUri' => $this->resolveLogoDataUri(),
            ])->setPaper('a4', 'portrait');

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
        $tempDirectory = storage_path('app/tmp/classement-exports/' . Str::ulid());
        File::ensureDirectoryExists($tempDirectory);

        if (!class_exists(ZipArchive::class)) {
            throw new \RuntimeException('L’extension ZIP n’est pas disponible sur le serveur.');
        }

        $files = [
            'classement_miss_2026.pdf' => $this->generateCategoryPdf('Miss'),
            'classement_mister_2026.pdf' => $this->generateCategoryPdf('Mister'),
        ];

        foreach ($files as $filename => $binaryContent) {
            $targetPath = $tempDirectory . DIRECTORY_SEPARATOR . $filename;
            $writtenBytes = @file_put_contents($targetPath, $binaryContent);

            if ($writtenBytes === false) {
                throw new \RuntimeException(sprintf('Impossible d’écrire le fichier temporaire %s.', $filename));
            }
        }

        $zipPath = $tempDirectory . DIRECTORY_SEPARATOR . 'classement_miss_mister_2026.zip';
        $zip = new ZipArchive();
        $opened = $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        if ($opened !== true) {
            throw new \RuntimeException('Impossible de créer l’archive ZIP des classements.');
        }

        foreach (array_keys($files) as $filename) {
            $zip->addFile($tempDirectory . DIRECTORY_SEPARATOR . $filename, $filename);
        }

        $zip->close();

        return [
            'zip_path' => $zipPath,
            'download_name' => 'classement_miss_mister_2026.zip',
            'temp_directory' => $tempDirectory,
        ];
    }

    public function cleanupExportArtifacts(?string $tempDirectory): void
    {
        if (!$tempDirectory || !is_dir($tempDirectory)) {
            return;
        }

        File::deleteDirectory($tempDirectory);
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
}
