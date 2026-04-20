<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\PartnerLogo;
use App\Models\Setting;
use App\Repositories\CandidateRepository;
use Illuminate\Support\Facades\Cache;

class PublicApiPayloadService
{
    private const CACHE_VERSION_KEY = 'public:payloads:version';
    private const CACHE_UPDATED_AT_KEY = 'public:payloads:updated_at';
    private const PUBLIC_CACHE_TTL_SECONDS = 60;
    private const PUBLIC_CANDIDATES_PER_PAGE = 50;

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

    private array $allowedKeys = [];
    private array $runtimeKeys = [];

    public function __construct(
        private CandidateRepository $candidates,
        private StatsService $stats,
        private VotingWindowService $votingWindow,
    ) {
        $this->runtimeKeys = $this->votingWindow->runtimeKeys();
        $this->allowedKeys = array_merge($this->booleanKeys, $this->intKeys, $this->dateKeys, [
            'currency',
        ]);
    }

    public function settingsPayload(): array
    {
        return Cache::remember($this->versionedCacheKey('settings:payload'), now()->addSeconds(self::PUBLIC_CACHE_TTL_SECONDS), function () {
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

            return array_merge($publicSettings, [
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
            ]);
        });
    }

    public function statsPayload(): array
    {
        return Cache::remember(
            $this->versionedCacheKey('stats:summary'),
            now()->addSeconds(self::PUBLIC_CACHE_TTL_SECONDS),
            fn () => $this->stats->publicSummary()
        );
    }

    public function paginatedCandidatesPayload(int $perPage = self::PUBLIC_CANDIDATES_PER_PAGE, ?string $category = null): array
    {
        $normalizedPerPage = max(12, min($perPage, self::PUBLIC_CANDIDATES_PER_PAGE));
        $normalizedCategory = filled($category) ? strtolower(trim((string) $category)) : '';
        $cacheKey = $this->versionedCacheKey('candidates:index:' . md5(json_encode([$normalizedPerPage, $normalizedCategory])));

        return Cache::remember($cacheKey, now()->addSeconds(self::PUBLIC_CACHE_TTL_SECONDS), function () use ($normalizedPerPage, $normalizedCategory) {
            $paginator = $this->candidates->paginatePublic($normalizedPerPage, $normalizedCategory !== '' ? $normalizedCategory : null);
            $paginator->setCollection(
                $paginator->getCollection()->map(fn (Candidate $candidate) => $this->presentListCandidate($candidate))
            );

            return $paginator->toArray();
        });
    }

    public function allCandidatesPayload(?string $category = null): array
    {
        $normalizedCategory = filled($category) ? strtolower(trim((string) $category)) : '';
        $cacheKey = $this->versionedCacheKey('candidates:collection:' . md5($normalizedCategory));

        return Cache::remember($cacheKey, now()->addSeconds(self::PUBLIC_CACHE_TTL_SECONDS), function () use ($normalizedCategory) {
            return $this->candidates
                ->listPublic($normalizedCategory !== '' ? $normalizedCategory : null)
                ->map(fn (Candidate $candidate) => $this->presentListCandidate($candidate))
                ->values()
                ->all();
        });
    }

    public function partnersPayload(): array
    {
        return Cache::remember($this->versionedCacheKey('partners:list'), now()->addSeconds(self::PUBLIC_CACHE_TTL_SECONDS), function () {
            $items = PartnerLogo::query()
                ->select(['id', 'name', 'website_url', 'logo_path', 'logo_meta', 'sort_order', 'is_active'])
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get();

            return [
                'data' => $items->map(fn (PartnerLogo $item) => $this->presentPartner($item))->values()->all(),
            ];
        });
    }

    public function initDataPayload(): array
    {
        return Cache::remember($this->versionedCacheKey('init-data:payload'), now()->addSeconds(self::PUBLIC_CACHE_TTL_SECONDS), function () {
            return [
                'settings' => $this->settingsPayload(),
                'stats' => $this->statsPayload(),
                'candidates' => $this->allCandidatesPayload(),
                'partners' => $this->partnersPayload()['data'],
                'meta' => [
                    'update_signal' => $this->updateSignalPayload(),
                ],
            ];
        });
    }

    public function updateSignalPayload(): array
    {
        return [
            'version' => $this->currentCacheVersion(),
            'timestamp' => $this->currentUpdateTimestamp(),
        ];
    }

    public function invalidatePublicData(): void
    {
        Cache::forever(self::CACHE_VERSION_KEY, $this->currentCacheVersion() + 1);
        Cache::forever(self::CACHE_UPDATED_AT_KEY, $this->freshUpdateTimestamp());
    }

    public function invalidateVotingData(): void
    {
        $this->invalidatePublicData();
    }

    public function versionedCacheKey(string $suffix): string
    {
        return 'public:v' . $this->currentCacheVersion() . ':' . ltrim($suffix, ':');
    }

    private function presentListCandidate(Candidate $candidate): array
    {
        $photoUrls = (array) $candidate->photo_urls;

        return [
            'public_uid' => $candidate->public_uid,
            'slug' => $candidate->slug,
            'first_name' => $candidate->first_name,
            'last_name' => $candidate->last_name,
            'public_number' => $candidate->public_number,
            'university' => $candidate->university,
            'votes_count' => (int) ($candidate->votes_count ?? 0),
            'photo_url' => $candidate->photo_url,
            'photo_urls' => array_filter([
                'thumbnail' => $photoUrls['thumbnail'] ?? null,
                'medium' => $photoUrls['medium'] ?? null,
            ]),
            'category' => [
                'name' => $candidate->category?->name,
            ],
        ];
    }

    private function presentPartner(PartnerLogo $item): array
    {
        return [
            'id' => $item->id,
            'name' => $item->name,
            'website_url' => $item->website_url,
            'logo_path' => $item->logo_path,
            'logo_url' => $item->logo_url,
            'sort_order' => (int) $item->sort_order,
            'is_active' => (bool) $item->is_active,
        ];
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

    private function currentCacheVersion(): int
    {
        $version = (int) Cache::get(self::CACHE_VERSION_KEY, 1);

        return $version > 0 ? $version : 1;
    }

    private function currentUpdateTimestamp(): int
    {
        $timestamp = (int) Cache::get(self::CACHE_UPDATED_AT_KEY, 0);

        return $timestamp > 0 ? $timestamp : 0;
    }

    private function freshUpdateTimestamp(): int
    {
        $current = $this->currentUpdateTimestamp();
        $next = (int) round(microtime(true) * 1000);

        return $next > $current ? $next : ($current + 1);
    }
}
