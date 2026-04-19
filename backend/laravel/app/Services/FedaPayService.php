<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Arr;

class FedaPayService
{
    public function publicKey(): ?string
    {
        return $this->configValue('services.fedapay.public_key');
    }

    public function secretKey(): ?string
    {
        return $this->configValue('services.fedapay.secret_key');
    }

    public function webhookSecret(): ?string
    {
        return $this->configValue('services.fedapay.webhook_secret');
    }

    public function environment(): string
    {
        $value = strtolower((string) $this->configValue('services.fedapay.environment', 'sandbox'));

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

        $response = Http::baseUrl($this->apiBaseUrl())
            ->acceptJson()
            ->asJson()
            ->withToken($this->requireSecretKey())
            ->post('/transactions', $payload)
            ->throw()
            ->json();

        return $this->normalizeTransactionPayload((array) $response);
    }

    /**
     * @throws ConnectionException
     * @throws RequestException
     */
    public function retrieveTransaction(int|string $transactionId): ?array
    {
        $response = Http::baseUrl($this->apiBaseUrl())
            ->acceptJson()
            ->withToken($this->requireSecretKey())
            ->get('/transactions/' . $transactionId)
            ->throw()
            ->json();

        return $this->normalizeTransactionPayload((array) $response);
    }

    /**
     * @throws ConnectionException
     * @throws RequestException
     */
    public function generateTransactionToken(int|string $transactionId): array
    {
        $response = Http::baseUrl($this->apiBaseUrl())
            ->acceptJson()
            ->asJson()
            ->withToken($this->requireSecretKey())
            ->post('/transactions/' . $transactionId . '/token')
            ->throw()
            ->json();

        return $this->normalizeTokenPayload((array) $response);
    }

    /**
     * @throws ConnectionException
     * @throws RequestException
     */
    public function searchTransactions(array $params = []): array
    {
        return $this->searchTransactionsDebug($params)['normalized'];
    }

    /**
     * @throws ConnectionException
     * @throws RequestException
     */
    public function searchTransactionsDebug(array $params = []): array
    {
        $response = Http::baseUrl($this->apiBaseUrl())
            ->acceptJson()
            ->withToken($this->requireSecretKey())
            ->get('/transactions/search', $params)
            ->throw();

        $decoded = $response->json();
        $payload = is_array($decoded) ? $decoded : [];
        $rawList = $this->extractTransactionListCandidate($payload);
        $normalized = $this->normalizeTransactionListPayload($payload);

        return [
            'normalized' => $normalized,
            'response_status' => $response->status(),
            'top_level_type' => is_array($decoded)
                ? (array_is_list($decoded) ? 'list' : 'object')
                : gettype($decoded),
            'top_level_keys' => is_array($payload) && !array_is_list($payload)
                ? array_slice(array_map('strval', array_keys($payload)), 0, 12)
                : [],
            'raw_list_count' => is_array($rawList) ? count($rawList) : 0,
            'normalized_count' => count($normalized),
            'status_histogram' => $this->buildStatusHistogram($rawList ?? []),
            'payload_preview' => $this->previewPayload($decoded),
        ];
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

    private function configValue(string $configKey, ?string $default = null): ?string
    {
        $value = config($configKey);
        if ($value !== null && $value !== '') {
            return (string) $value;
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

    private function normalizeTransactionPayload(array $payload): array
    {
        if ($this->looksLikeTransaction($payload)) {
            return $payload;
        }

        $candidates = [
            Arr::get($payload, 'data'),
            Arr::get($payload, 'transaction'),
            Arr::get($payload, 'v1/transaction'),
            Arr::get($payload, 'v1.transaction'),
            Arr::get($payload, 'data.transaction'),
            Arr::get($payload, 'data.attributes'),
        ];

        foreach ($candidates as $candidate) {
            if (is_array($candidate) && $this->looksLikeTransaction($candidate)) {
                return $candidate;
            }
        }

        foreach ($payload as $value) {
            if (is_array($value) && $this->looksLikeTransaction($value)) {
                return $value;
            }
        }

        return $payload;
    }

    private function normalizeTokenPayload(array $payload): array
    {
        $candidates = [
            $payload,
            Arr::get($payload, 'data'),
            Arr::get($payload, 'token'),
            Arr::get($payload, 'data.token'),
            Arr::get($payload, 'v1/token'),
            Arr::get($payload, 'v1.token'),
        ];

        foreach ($candidates as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }

            $url = trim((string) Arr::get($candidate, 'url', ''));
            $token = trim((string) Arr::get($candidate, 'token', ''));

            if ($url !== '' || $token !== '') {
                return $candidate;
            }
        }

        return $payload;
    }

    private function normalizeTransactionListPayload(array $payload): array
    {
        $candidate = $this->extractTransactionListCandidate($payload);

        if (is_array($candidate)) {
            return array_values(array_filter(array_map(function ($transaction) {
                return is_array($transaction)
                    ? $this->normalizeTransactionPayload($transaction)
                    : null;
            }, $candidate)));
        }

        if ($this->looksLikeTransaction($payload)) {
            return [$this->normalizeTransactionPayload($payload)];
        }

        return [];
    }

    private function looksLikeTransaction(array $payload): bool
    {
        return Arr::has($payload, 'id')
            || Arr::has($payload, 'status')
            || Arr::has($payload, 'reference')
            || Arr::has($payload, 'merchant_reference');
    }

    private function looksLikeTransactionList(mixed $payload): bool
    {
        if (!is_array($payload) || !array_is_list($payload) || $payload === []) {
            return false;
        }

        foreach ($payload as $item) {
            if (is_array($item) && $this->looksLikeTransaction($item)) {
                return true;
            }
        }

        return false;
    }

    private function extractTransactionListCandidate(mixed $payload, int $depth = 0): ?array
    {
        if ($depth > 6 || !is_array($payload)) {
            return null;
        }

        if ($this->looksLikeTransactionList($payload)) {
            return $payload;
        }

        foreach ($payload as $value) {
            if (!is_array($value)) {
                continue;
            }

            $candidate = $this->extractTransactionListCandidate($value, $depth + 1);
            if ($candidate !== null) {
                return $candidate;
            }
        }

        return null;
    }

    private function buildStatusHistogram(array $transactions): array
    {
        $histogram = [];

        foreach ($transactions as $transaction) {
            if (!is_array($transaction)) {
                continue;
            }

            $status = strtolower(trim((string) Arr::get($transaction, 'status', '')));
            $key = $status !== '' ? $status : '(empty)';
            $histogram[$key] = ($histogram[$key] ?? 0) + 1;
        }

        arsort($histogram);

        return $histogram;
    }

    private function previewPayload(mixed $payload): string
    {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (!is_string($json) || trim($json) === '') {
            return '(empty)';
        }

        $preview = trim($json);

        return strlen($preview) > 240
            ? substr($preview, 0, 240) . '...'
            : $preview;
    }
}
