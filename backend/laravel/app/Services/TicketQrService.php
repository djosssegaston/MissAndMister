<?php

namespace App\Services;

use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

class TicketQrService
{
    private string $secret;

    public function __construct()
    {
        $this->secret = config('app.key');
    }

    /**
     * Generate a signed QR payload for a ticket.
     *
     * @return array{code: string, token: string, sig: string}
     */
    public function generatePayload(string $ticketCode, string $qrToken): array
    {
        $sig = $this->sign($ticketCode, $qrToken);

        return [
            'code' => $ticketCode,
            'token' => $qrToken,
            'sig' => $sig,
        ];
    }

    /**
     * Build the JSON string to encode in the QR code.
     */
    public function buildQrContent(string $ticketCode, string $qrToken): string
    {
        $payload = $this->generatePayload($ticketCode, $qrToken);

        return json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    /**
     * Verify the HMAC signature of a scanned QR payload.
     */
    public function verifySignature(string $ticketCode, string $qrToken, string $sig): bool
    {
        $expected = $this->sign($ticketCode, $qrToken);

        return hash_equals($expected, $sig);
    }

    /**
     * Generate an SVG string of the QR code.
     */
    public function generateSvg(string $content, int $size = 200): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle($size, 0, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(0, 0, 0))),
            new SvgImageBackEnd,
        );

        $writer = new Writer($renderer);

        return $writer->writeString($content);
    }

    /**
     * Generate a base64 SVG data URI of the QR code.
     */
    public function generatePng(string $content, int $size = 200): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle($size, 0, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(0, 0, 0))),
            new SvgImageBackEnd,
        );

        $writer = new Writer($renderer);
        $svg = $writer->writeString($content);

        // Convert SVG to base64 data URI for PDF embedding
        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    /**
     * Generate a base64 SVG data URI of the QR code for embedding in PDF/HTML.
     */
    public function generateQrImageUri(string $content, int $size = 200): string
    {
        return $this->generatePng($content, $size);
    }

    private function sign(string $ticketCode, string $qrToken): string
    {
        $payload = $ticketCode.'|'.$qrToken;

        return hash_hmac('sha256', $payload, $this->secret);
    }
}
