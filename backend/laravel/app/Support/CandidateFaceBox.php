<?php

namespace App\Support;

final readonly class CandidateFaceBox
{
    public function __construct(
        public int $x,
        public int $y,
        public int $width,
        public int $height,
        public float $confidence = 0.0,
    ) {
    }

    public static function fromArray(?array $data): ?self
    {
        if (!$data) {
            return null;
        }

        return new self(
            x: (int) ($data['x'] ?? 0),
            y: (int) ($data['y'] ?? 0),
            width: (int) ($data['width'] ?? 0),
            height: (int) ($data['height'] ?? 0),
            confidence: (float) ($data['confidence'] ?? 0),
        );
    }

    public function toArray(): array
    {
        return [
            'x' => $this->x,
            'y' => $this->y,
            'width' => $this->width,
            'height' => $this->height,
            'confidence' => round($this->confidence, 2),
        ];
    }

    public function centerX(): float
    {
        return $this->x + ($this->width / 2);
    }

    public function centerY(): float
    {
        return $this->y + ($this->height / 2);
    }
}
