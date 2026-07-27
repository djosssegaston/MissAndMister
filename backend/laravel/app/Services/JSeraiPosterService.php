<?php

namespace App\Services;

use App\Models\JSeraiTicket;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\PngEncoder;
use Intervention\Image\ImageManager;
use Intervention\Image\Typography\Font;

class JSeraiPosterService
{
    private const DEFAULT_FONT_SIZE = 36;

    private const DEFAULT_FONT_COLOR = 'ffffff';

    private ImageManager $image;

    public function __construct()
    {
        $this->image = new ImageManager(new Driver);
    }

    public function generate(JSeraiTicket $ticket): string
    {
        $template = $ticket->template;

        if (! $template) {
            throw new \RuntimeException('Aucun template actif trouvé.');
        }

        $templatePath = Storage::disk('public')->path($template->file_path);

        if (! file_exists($templatePath)) {
            throw new \RuntimeException('Le fichier template est introuvable.');
        }

        $image = $this->image->decode($templatePath);

        $config = $template->overlay_config ?? [];

        $this->applyPhoto($image, $ticket, $config);
        $this->applyMask($image, $template);
        $this->applyText($image, $ticket, $config);

        $filename = sprintf(
            'j-serai/%s/poster_%s.png',
            $ticket->uuid,
            now()->format('YmdHis')
        );

        $encoded = $image->encode(new PngEncoder);

        try {
            Storage::disk('public')->put($filename, (string) $encoded);
        } catch (\Throwable $e) {
            throw new \RuntimeException('Erreur lors de la sauvegarde du poster: '.$e->getMessage(), 0, $e);
        }

        return $filename;
    }

    private function applyPhoto($image, JSeraiTicket $ticket, array $config): void
    {
        if (! $ticket->photo_path) {
            return;
        }

        $photoPath = Storage::disk('public')->path($ticket->photo_path);

        if (! file_exists($photoPath)) {
            return;
        }

        $photoConfig = $config['photo'] ?? [];

        if (empty($photoConfig)) {
            return;
        }

        $targetWidth = (int) ($photoConfig['width'] ?? 300);
        $targetHeight = (int) ($photoConfig['height'] ?? 300);
        $offsetX = (int) ($photoConfig['x'] ?? 0);
        $offsetY = (int) ($photoConfig['y'] ?? 0);
        $borderRadius = (int) ($photoConfig['border_radius'] ?? 0);

        $userPhoto = $this->image->decode($photoPath);
        $userPhoto->cover($targetWidth, $targetHeight);

        if ($borderRadius > 0) {
            $this->applyRoundedMask($userPhoto, $targetWidth, $targetHeight, $borderRadius);
        }

        $image->insert($userPhoto, $offsetX, $offsetY);
    }

    private function applyRoundedMask($photo, int $width, int $height, int $radius): void
    {
        $gd = $photo->core()->native();
        $mask = imagecreatetruecolor($width, $height);
        $transparent = imagecolorallocatealpha($mask, 0, 0, 0, 127);
        $opaque = imagecolorallocatealpha($mask, 0, 0, 0, 0);

        imagefill($mask, 0, 0, $transparent);
        imagesetthickness($mask, 0);
        $white = imagecolorallocate($mask, 255, 255, 255);

        $r = min($radius, (int) ($width / 2), (int) ($height / 2));

        imagefilledrectangle($mask, $r, 0, $width - $r - 1, $height - 1, $white);
        imagefilledrectangle($mask, 0, $r, $width - 1, $height - $r - 1, $white);

        imagefilledellipse($mask, $r, $r, $r * 2, $r * 2, $white);
        imagefilledellipse($mask, $width - $r - 1, $r, $r * 2, $r * 2, $white);
        imagefilledellipse($mask, $r, $height - $r - 1, $r * 2, $r * 2, $white);
        imagefilledellipse($mask, $width - $r - 1, $height - $r - 1, $r * 2, $r * 2, $white);

        imagealphablending($gd, false);
        imagesavealpha($gd, true);

        for ($x = 0; $x < $width; $x++) {
            for ($y = 0; $y < $height; $y++) {
                $maskAlpha = (imagecolorat($mask, $x, $y) >> 24) & 0x7F;
                if ($maskAlpha === 127) {
                    imagesetpixel($gd, $x, $y, imagecolorallocatealpha($gd, 0, 0, 0, 127));
                }
            }
        }

        imagedestroy($mask);
    }

    private function applyMask($image, $template): void
    {
        if (! $template->mask_path) {
            return;
        }

        $maskPath = Storage::disk('public')->path($template->mask_path);

        if (! file_exists($maskPath)) {
            return;
        }

        $mask = $this->image->decode($maskPath);
        $image->insert($mask, 0, 0);
    }

    private function applyText($image, JSeraiTicket $ticket, array $config): void
    {
        $fontPath = $this->resolveFontPath($config['font_family'] ?? null);

        $this->drawText(
            $image,
            $ticket->first_name,
            $config['first_name'] ?? [],
            $fontPath,
        );

        if ($ticket->phone) {
            $phoneConfig = $config['phone'] ?? [];
            $phoneNumber = $this->formatPhone($ticket->phone);
            $this->drawText($image, $phoneNumber, $phoneConfig, $fontPath);
        }

        if ($ticket->email) {
            $emailConfig = $config['email'] ?? [];
            $this->drawText($image, $ticket->email, $emailConfig, $fontPath);
        }
    }

    private function drawText($image, string $text, array $config, ?string $fontPath): void
    {
        $x = (int) ($config['x'] ?? 0);
        $y = (int) ($config['y'] ?? 0);
        $size = (int) ($config['font_size'] ?? self::DEFAULT_FONT_SIZE);
        $color = $config['font_color'] ?? self::DEFAULT_FONT_COLOR;

        $font = new Font;
        $font->setSize($size);
        $font->setColor($color);

        if ($fontPath && file_exists($fontPath)) {
            $font->setFilepath($fontPath);
        }

        $horizontal = $config['align'] ?? 'left';
        $font->setAlignmentHorizontal($horizontal);

        $vertical = $config['valign'] ?? 'top';
        if ($vertical === 'middle') {
            $vertical = 'center';
        }
        $font->setAlignmentVertical($vertical);

        $image->text($text, $x, $y, $font);
    }

    private function resolveFontPath(?string $configuredFont): ?string
    {
        if ($configuredFont && file_exists($configuredFont)) {
            return $configuredFont;
        }

        $defaultFont = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

        if (file_exists($defaultFont)) {
            return $defaultFont;
        }

        return null;
    }

    private function formatPhone(string $phone): string
    {
        $cleaned = preg_replace('/[^0-9+]/', '', $phone);

        $length = strlen($cleaned);
        if ($length === 8 || $length === 10) {
            return rtrim(chunk_split($cleaned, 2, ' '));
        }

        return $phone;
    }
}
