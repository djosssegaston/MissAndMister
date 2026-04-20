<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\PublicApiPayloadService;
use App\Services\VotingWindowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class SettingsController extends Controller
{
    private array $booleanKeys = [
        'voting_open',
        'gallery_public',
        'results_public',
        'email_confirm',
        'sms_confirm',
        'captcha_enabled',
        'ip_tracking_enabled',
        'maintenance_mode',
    ];

    private array $intKeys = [
        'price_per_vote',
        'max_votes_per_day',
    ];

    private array $dateKeys = [
        'vote_start_at',
        'vote_end_at',
        'maintenance_end_at',
    ];
    private array $superadminOnlyKeys = [
        'maintenance_mode',
        'maintenance_end_at',
    ];

    private array $runtimeKeys = [];

    private array $allowedKeys = [];
    private array $writableKeys = [];

    public function __construct(
        private VotingWindowService $votingWindow,
        private PublicApiPayloadService $publicApi,
    ) {
        $this->runtimeKeys = $this->votingWindow->runtimeKeys();
        $this->allowedKeys = array_merge($this->booleanKeys, $this->intKeys, $this->dateKeys, [
            'currency',
        ]);
        $this->writableKeys = $this->allowedKeys;
    }

    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $writableKeys = $this->writableKeysForCurrentUser();

        return response()->json($this->formatCollection(
            Setting::whereIn('key', array_merge($writableKeys, $this->runtimeKeys))->get()
        ));
    }

    public function store(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $payload = request()->input('settings', []);

        // Also accept flat key/value body
        if (empty($payload) && request()->isJson()) {
            $payload = request()->all();
        }

        Validator::make(['settings' => $payload], [
            'settings' => ['required', 'array'],
        ])->validate();
        $writableKeys = $this->writableKeysForCurrentUser();

        $currentSettings = $this->formatCollection(
            Setting::whereIn('key', array_merge($writableKeys, $this->runtimeKeys))->get()
        );

        $nextSettings = $currentSettings;
        $validatedSettings = [];

        foreach ($payload as $key => $value) {
            if (!in_array($key, $writableKeys, true)) {
                continue;
            }

            $validatedValue = $this->sanitizeValue($key, $value);
            $validatedSettings[$key] = $validatedValue;
            $nextSettings[$key] = $this->castValue($key, $validatedValue);
        }

        $runtimeSettings = $this->votingWindow->syncPauseState($currentSettings, $nextSettings);
        $result = [];

        foreach ($validatedSettings as $key => $validatedValue) {
            $setting = Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $validatedValue,
                    'group' => $this->resolveGroup($key),
                    'status' => 'active',
                ]
            );

            $result[$key] = $this->castValue($key, $setting->value);
        }

        $this->persistRuntimeSettings($runtimeSettings);

        return response()->json($result, 201);
    }

    public function update(Setting $setting): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        abort_unless(in_array($setting->key, $this->writableKeysForCurrentUser(), true), 404);
        $data = Validator::make(request()->all(), [
            'value' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
        ])->validate();

        $setting->update($data);
        return response()->json($this->format($setting));
    }

    public function public(): JsonResponse
    {
        return response()->json($this->publicApi->settingsPayload());
    }

    private function resolveGroup(string $key): string
    {
        return match (true) {
            in_array($key, $this->booleanKeys, true) => 'features',
            in_array($key, $this->intKeys, true) => 'rules',
            in_array($key, $this->dateKeys, true) => 'dates',
            $key === 'currency' => 'payments',
            default => 'general',
        };
    }

    private function sanitizeValue(string $key, $value): string
    {
        if (in_array($key, $this->booleanKeys, true)) {
            return $value ? '1' : '0';
        }

        if (in_array($key, $this->intKeys, true)) {
            return (string) (int) $value;
        }

        if (in_array($key, $this->dateKeys, true)) {
            return (string) $value;
        }

        return (string) $value;
    }

    private function writableKeysForCurrentUser(): array
    {
        $role = request()->user()?->role ?? null;

        if ($role === 'superadmin') {
            return $this->writableKeys;
        }

        return array_values(array_diff($this->writableKeys, $this->superadminOnlyKeys));
    }

    private function castValue(string $key, ?string $value)
    {
        if (in_array($key, $this->booleanKeys, true)) {
            return $value === '1' || $value === 'true' || $value === 1 || $value === true;
        }

        if (in_array($key, $this->intKeys, true)) {
            return (int) $value;
        }

        return $value;
    }

    private function format(Setting $setting): array
    {
        return [
            'key' => $setting->key,
            'value' => $this->castValue($setting->key, $setting->value),
            'group' => $setting->group,
            'status' => $setting->status,
        ];
    }

    private function formatCollection($settings): array
    {
        $result = [];
        foreach ($settings as $setting) {
            $result[$setting->key] = $this->castValue($setting->key, $setting->value);
        }
        return $result;
    }

    private function persistRuntimeSettings(array $runtimeSettings): void
    {
        foreach ($runtimeSettings as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $value,
                    'group' => 'runtime',
                    'status' => 'active',
                ]
            );
        }
    }

    private function extractRuntimeSettings(array $settings): array
    {
        return array_intersect_key($settings, array_flip($this->runtimeKeys));
    }
}
