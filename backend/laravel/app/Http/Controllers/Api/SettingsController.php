<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
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

    private array $runtimeKeys = [];

    private array $allowedKeys = [];
    private array $writableKeys = [];

    public function __construct(private VotingWindowService $votingWindow)
    {
        $this->runtimeKeys = $this->votingWindow->runtimeKeys();
        $this->allowedKeys = array_merge($this->booleanKeys, $this->intKeys, $this->dateKeys, [
            'currency',
        ]);
        $this->writableKeys = $this->allowedKeys;
    }

    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);

        return response()->json($this->formatCollection(
            Setting::whereIn('key', array_merge($this->writableKeys, $this->runtimeKeys))->get()
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

        $currentSettings = $this->formatCollection(
            Setting::whereIn('key', array_merge($this->writableKeys, $this->runtimeKeys))->get()
        );

        $nextSettings = $currentSettings;
        $validatedSettings = [];

        foreach ($payload as $key => $value) {
            if (!in_array($key, $this->writableKeys, true)) {
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
        abort_unless(in_array($setting->key, $this->writableKeys, true), 404);
        $data = Validator::make(request()->all(), [
            'value' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive'],
        ])->validate();

        $setting->update($data);
        return response()->json($this->format($setting));
    }

    public function public(): JsonResponse
    {
        $settings = Setting::where('status', 'active')
            ->whereIn('key', array_merge($this->allowedKeys, $this->runtimeKeys))
            ->get();

        $formatted = $this->formatCollection($settings);
        $normalizedRuntime = $this->votingWindow->normalizeRuntimeSettings($formatted);
        if ($this->extractRuntimeSettings($formatted) !== $normalizedRuntime) {
            $this->persistRuntimeSettings($normalizedRuntime);
            $formatted = array_merge($formatted, $normalizedRuntime);
        }

        $publicSettings = array_intersect_key($formatted, array_flip($this->allowedKeys));
        $votingStatus = $this->votingWindow->computeState($formatted);

        return response()->json(array_merge($publicSettings, [
            'maintenance_mode' => $votingStatus['maintenance_active'],
            'maintenance_end_at_iso' => $votingStatus['maintenance_end']?->toIso8601String(),
            'maintenance_remaining_seconds' => $votingStatus['maintenance_remaining_seconds'],
            'voting_blocked' => $votingStatus['blocked'],
            'voting_open_now' => !$votingStatus['blocked'],
            'voting_block_reason' => $votingStatus['reason'],
            'voting_block_message' => $votingStatus['message'],
            'server_time' => $votingStatus['now']->toIso8601String(),
            'vote_start_at_iso' => $votingStatus['start']?->toIso8601String(),
            'vote_end_at_iso' => $votingStatus['effective_end']?->toIso8601String(),
            'vote_end_at_effective_iso' => $votingStatus['effective_end']?->toIso8601String(),
            'countdown_paused' => $votingStatus['countdown_paused'],
            'countdown_total_seconds' => $votingStatus['countdown_total_seconds'],
            'countdown_remaining_seconds' => $votingStatus['countdown_remaining_seconds'],
        ]));
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
