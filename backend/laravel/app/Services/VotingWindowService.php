<?php

namespace App\Services;

use Illuminate\Support\Carbon;

class VotingWindowService
{
    public function runtimeKeys(): array
    {
        return [
            'countdown_pause_started_at',
            'countdown_paused_seconds',
        ];
    }

    public function computeState(array $settings, ?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : now();
        $settings = array_merge($settings, $this->normalizeRuntimeSettings($settings, $now));

        $maintenanceEnd = $this->parseInstant($settings['maintenance_end_at'] ?? null);
        $maintenance = $this->isTruthy($settings['maintenance_mode'] ?? false)
            && (!$maintenanceEnd || $now->lt($maintenanceEnd));
        $votingOpen = $this->isTruthy($settings['voting_open'] ?? true);
        $start = $this->parseDateBoundary($settings['vote_start_at'] ?? null, false);
        $end = $this->parseDateBoundary($settings['vote_end_at'] ?? null, true);

        $countdownPaused = $this->shouldPauseCountdown($settings, $now, $start, $end, $maintenance);
        $pauseStartedAt = $this->parseInstant($settings['countdown_pause_started_at'] ?? null);
        $accumulatedPauseSeconds = max(0, (int) ($settings['countdown_paused_seconds'] ?? 0));
        $livePauseSeconds = ($countdownPaused && $pauseStartedAt)
            ? $pauseStartedAt->diffInSeconds($now)
            : 0;

        $effectiveEnd = $end
            ? $end->copy()->addSeconds($accumulatedPauseSeconds + $livePauseSeconds)
            : null;

        $baseStart = $start ? $start->copy() : $now->copy();
        $countdownTotalSeconds = $end
            ? max(0, $end->getTimestamp() - $baseStart->getTimestamp())
            : 0;
        $countdownRemainingSeconds = $effectiveEnd
            ? max(0, $effectiveEnd->getTimestamp() - $now->getTimestamp())
            : 0;

        $blocked = false;
        $reason = 'open';
        $message = 'Vote ouvert';

        if ($maintenance) {
            $blocked = true;
            $reason = 'maintenance';
            $message = 'Plateforme en maintenance';
        } elseif (!$votingOpen) {
            $blocked = true;
            $reason = 'toggle_off';
            $message = 'Vote bloquer';
        } elseif ($start && $now->lt($start)) {
            $blocked = true;
            $reason = 'not_started';
            $message = 'Les votes ne sont pas encore ouverts';
        } elseif ($effectiveEnd && $now->gt($effectiveEnd)) {
            $blocked = true;
            $reason = 'ended';
            $message = 'Vote bloquer';
        }

        return [
            'blocked' => $blocked,
            'reason' => $reason,
            'message' => $message,
            'now' => $now,
            'start' => $start,
            'end' => $end,
            'effective_end' => $effectiveEnd,
            'maintenance_active' => $maintenance,
            'maintenance_end' => $maintenanceEnd,
            'maintenance_remaining_seconds' => ($maintenance && $maintenanceEnd)
                ? max(0, $maintenanceEnd->getTimestamp() - $now->getTimestamp())
                : 0,
            'countdown_paused' => $countdownPaused,
            'countdown_total_seconds' => $countdownTotalSeconds,
            'countdown_remaining_seconds' => $countdownRemainingSeconds,
        ];
    }

    public function syncPauseState(array $currentSettings, array $nextSettings, ?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : now();
        $normalizedCurrentRuntime = $this->normalizeRuntimeSettings($currentSettings, $now);
        $currentSettings = array_merge($currentSettings, $normalizedCurrentRuntime);
        $nextSettings = array_merge($nextSettings, $normalizedCurrentRuntime);

        $currentState = $this->computeState($currentSettings, $now);
        $nextState = $this->computeState($nextSettings, $now);
        $pauseStartedAt = $this->parseInstant($currentSettings['countdown_pause_started_at'] ?? null);
        $accumulatedPauseSeconds = max(0, (int) ($currentSettings['countdown_paused_seconds'] ?? 0));

        if (!$currentState['countdown_paused'] && $nextState['countdown_paused']) {
            return [
                'countdown_pause_started_at' => $now->toIso8601String(),
                'countdown_paused_seconds' => (string) $accumulatedPauseSeconds,
            ];
        }

        if ($currentState['countdown_paused'] && !$nextState['countdown_paused']) {
            if ($pauseStartedAt) {
                $accumulatedPauseSeconds += $pauseStartedAt->diffInSeconds($now);
            }

            return [
                'countdown_pause_started_at' => null,
                'countdown_paused_seconds' => (string) $accumulatedPauseSeconds,
            ];
        }

        if ($nextState['countdown_paused'] && !$pauseStartedAt) {
            return [
                'countdown_pause_started_at' => $now->toIso8601String(),
                'countdown_paused_seconds' => (string) $accumulatedPauseSeconds,
            ];
        }

        return [
            'countdown_pause_started_at' => $pauseStartedAt?->toIso8601String(),
            'countdown_paused_seconds' => (string) $accumulatedPauseSeconds,
        ];
    }

    public function normalizeRuntimeSettings(array $settings, ?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : now();
        $pauseStartedAt = $this->parseInstant($settings['countdown_pause_started_at'] ?? null);
        $accumulatedPauseSeconds = max(0, (int) ($settings['countdown_paused_seconds'] ?? 0));
        $start = $this->parseDateBoundary($settings['vote_start_at'] ?? null, false);
        $end = $this->parseDateBoundary($settings['vote_end_at'] ?? null, true);
        $maintenanceEnd = $this->parseInstant($settings['maintenance_end_at'] ?? null);
        $maintenanceActive = $this->isTruthy($settings['maintenance_mode'] ?? false)
            && (!$maintenanceEnd || $now->lt($maintenanceEnd));
        $shouldPause = $this->shouldPauseCountdown($settings, $now, $start, $end, $maintenanceActive);

        if ($shouldPause && !$pauseStartedAt) {
            $pauseStartedAt = $now->copy();
        }

        if (!$shouldPause && $pauseStartedAt && $maintenanceEnd && $now->gte($maintenanceEnd)) {
            if ($maintenanceEnd->gt($pauseStartedAt)) {
                $accumulatedPauseSeconds += $pauseStartedAt->diffInSeconds($maintenanceEnd);
            }
            $pauseStartedAt = null;
        }

        return [
            'countdown_pause_started_at' => $pauseStartedAt?->toIso8601String(),
            'countdown_paused_seconds' => (string) $accumulatedPauseSeconds,
        ];
    }

    private function shouldPauseCountdown(
        array $settings,
        Carbon $now,
        ?Carbon $start = null,
        ?Carbon $end = null,
        ?bool $maintenanceActive = null,
    ): bool
    {
        $maintenanceActive ??= $this->isTruthy($settings['maintenance_mode'] ?? false);
        $manualBlock = $maintenanceActive
            || !$this->isTruthy($settings['voting_open'] ?? true);

        if (!$manualBlock) {
            return false;
        }

        $start ??= $this->parseDateBoundary($settings['vote_start_at'] ?? null, false);
        $end ??= $this->parseDateBoundary($settings['vote_end_at'] ?? null, true);

        if ($start && $now->lt($start)) {
            return false;
        }

        if ($end && $now->gt($end)) {
            return false;
        }

        return true;
    }

    private function isTruthy($value): bool
    {
        return in_array($value, [true, 1, '1', 'true', 'on'], true);
    }

    private function parseDateBoundary($value, bool $endOfDay): ?Carbon
    {
        if (!$value || !is_string($value)) {
            return null;
        }

        try {
            $date = Carbon::parse($value);
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                $date = $endOfDay ? $date->endOfDay() : $date->startOfDay();
            }

            return $date;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function parseInstant($value): ?Carbon
    {
        if (!$value || !is_string($value)) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
