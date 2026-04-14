<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class FedaPayService
{
    private const ENVIRONMENT_KEY = 'fedapay_environment';
    private const PUBLIC_KEY = 'fedapay_public_key';
    private const SECRET_KEY = 'fedapay_secret_key';
    private const WEBHOOK_SECRET_KEY = 'fedapay_webhook_secret';

    public function publicKey(): ?string
    {
        return $this->settingValue(self::PUBLIC_KEY, 'services.fedapay.public_key');
    }

    public function secretKey(): ?string
    {
        return $this->settingValue(self::SECRET_KEY, 'services.fedapay.secret_key');
    }

    public function webhookSecret(): ?string
    {
        return $this->settingValue(self::WEBHOOK_SECRET_KEY, 'services.fedapay.webhook_secret', $this->secretKey());
    }

    public function environment(): string
    {
        $value = strtolower((string) $this->settingValue(self::ENVIRONMENT_KEY, 'services.fedapay.environment', 'sandbox'));

        return in_array($value, ['live', 'sandbox'], true) ? $value : 'sandbox';
    }

    public function isConfigured(): bool
    {
        return filled($this->publicKey()) && filled($this->secretKey());
    }

    public function apiBaseUrl(): string
    {
        return $this->environment() === 'live'
            ? 'https://api.fedapay.com/v1'
            : 'https://sandbox-api.fedapay.com/v1';
    }

    /**
     * @throws ConnectionException
     * @throws RequestException
     */
    public function createTransaction(
        float $amount,
        string $currency,
        string $description,
        string $callbackUrl,
        string $merchantReference,
        array $customMetadata = [],
        ?array $customer = null,
        ?string $mode = null,
    ): array {
        $payload = [
            'description' => $description,
            'amount' => (int) round($amount),
            'currency' => [
                'iso' => strtoupper($currency),
            ],
            'callback_url' => $callbackUrl,
            'merchant_reference' => $merchantReference,
            'custom_metadata' => $customMetadata,
        ];

        if ($customer) {
            $payload['customer'] = $customer;
        }

        if ($mode) {
            $payload['mode'] = $mode;
        }

        return Http::baseUrl($this->apiBaseUrl())
            ->acceptJson()
            ->asJson()
            ->withToken($this->requireSecretKey())
            ->post('/transactions', $payload)
            ->throw()
            ->json();
    }

    /**
     * @throws ConnectionException
     * @throws RequestException
     */
    public function retrieveTransaction(int|string $transactionId): ?array
    {
        return Http::baseUrl($this->apiBaseUrl())
            ->acceptJson()
            ->withToken($this->requireSecretKey())
            ->get('/transactions/' . $transactionId)
            ->throw()
            ->json();
    }

    public function verifyWebhookSignature(string $payload, ?string $signature): bool
    {
        $secret = $this->webhookSecret();

        if (!$secret || !$signature) {
            return false;
        }

        $normalized = trim($signature);
        $expectedCandidates = [
            hash_hmac('sha256', $payload, $secret),
        ];

        $parts = [];
        foreach (preg_split('/\s*,\s*/', $normalized) ?: [] as $part) {
            if (!str_contains($part, '=')) {
                continue;
            }

            [$name, $value] = array_map('trim', explode('=', $part, 2));

            if ($name !== '' && $value !== '') {
                $parts[strtolower($name)] = $value;
            }
        }

        if (!empty($parts['t'])) {
            $timestamp = $parts['t'];
            $expectedCandidates[] = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
            $expectedCandidates[] = hash_hmac('sha256', $timestamp . $payload, $secret);
        }

        foreach ($expectedCandidates as $expected) {
            if (hash_equals($expected, $normalized)) {
                return true;
            }
        }

        foreach ($parts as $name => $value) {
            if ($value === '') {
                continue;
            }

            if (in_array($name, ['v1', 'signature', 'sha256', 'hash'], true)) {
                foreach ($expectedCandidates as $expected) {
                    if (hash_equals($expected, $value)) {
                        return true;
                    }
                }
            }
        }

        if (hash_equals($expectedCandidates[0], $normalized)) {
            return true;
        }

        return false;
    }

    private function settingValue(string $key, ?string $fallbackConfig = null, ?string $default = null): ?string
    {
        $value = Setting::query()->where('key', $key)->value('value');

        if ($value !== null && $value !== '') {
            return (string) $value;
        }

        if ($fallbackConfig) {
            $configValue = config($fallbackConfig);

            if ($configValue !== null && $configValue !== '') {
                return (string) $configValue;
            }
        }

        return $default;
    }

    private function requireSecretKey(): string
    {
        $secret = $this->secretKey();

        if (!$secret) {
            throw new \RuntimeException('La clé secrète FedaPay n’est pas configurée.');
        }

        return $secret;
    }
}
