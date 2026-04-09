<?php

namespace App\Services\CandidateImages;

use App\Contracts\CandidateFaceDetector;
use App\Support\CandidateFaceBox;
use Aws\Rekognition\RekognitionClient;
use RuntimeException;

class AwsRekognitionCandidateFaceDetector implements CandidateFaceDetector
{
    public function __construct(
        private readonly array $config,
    ) {
    }

    public function detect(string $absolutePath): ?CandidateFaceBox
    {
        if (!is_file($absolutePath)) {
            throw new RuntimeException('Image introuvable pour la detection de visage.');
        }

        $size = @getimagesize($absolutePath);
        if (!$size) {
            throw new RuntimeException('Impossible de lire les dimensions de l’image.');
        }

        $region = $this->config['region'] ?? null;
        if (!$region) {
            throw new RuntimeException('AWS Rekognition n’a pas de region configuree.');
        }

        $clientConfig = [
            'version' => $this->config['version'] ?? 'latest',
            'region' => $region,
        ];

        if (!empty($this->config['key']) && !empty($this->config['secret'])) {
            $clientConfig['credentials'] = [
                'key' => $this->config['key'],
                'secret' => $this->config['secret'],
            ];
        }

        try {
            $client = new RekognitionClient($clientConfig);
            $result = $client->detectFaces([
                'Image' => [
                    'Bytes' => file_get_contents($absolutePath),
                ],
                'Attributes' => ['DEFAULT'],
            ]);
        } catch (\Throwable $exception) {
            throw new RuntimeException(
                'La detection AWS Rekognition a echoue: ' . $exception->getMessage(),
                previous: $exception,
            );
        }

        $faces = collect($result->get('FaceDetails') ?? [])
            ->filter(fn (array $face) => isset($face['BoundingBox']))
            ->sortByDesc(function (array $face) {
                $box = $face['BoundingBox'];

                return ($box['Width'] ?? 0) * ($box['Height'] ?? 0);
            })
            ->values();

        $face = $faces->first();
        if (!$face) {
            return null;
        }

        $box = $face['BoundingBox'];
        $imageWidth = (int) $size[0];
        $imageHeight = (int) $size[1];

        $x = max(0, (int) floor(($box['Left'] ?? 0) * $imageWidth));
        $y = max(0, (int) floor(($box['Top'] ?? 0) * $imageHeight));
        $width = max(1, (int) ceil(($box['Width'] ?? 0) * $imageWidth));
        $height = max(1, (int) ceil(($box['Height'] ?? 0) * $imageHeight));

        return new CandidateFaceBox(
            x: min($x, max(0, $imageWidth - 1)),
            y: min($y, max(0, $imageHeight - 1)),
            width: min($width, $imageWidth),
            height: min($height, $imageHeight),
            confidence: (float) ($face['Confidence'] ?? 0),
        );
    }
}
