export const PUBLIC_SETTINGS_CACHE_KEY = 'app_public_settings_cache_v1';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isTruthy = (value) => [true, 1, '1', 'true', 'on'].includes(value);

export const parseDateLike = (value, endOfDay = false) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalizedValue = DATE_ONLY_PATTERN.test(value)
    ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`
    : value;

  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const readCachedPublicSettings = () => {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem(PUBLIC_SETTINGS_CACHE_KEY) || 'null');
  } catch {
    return null;
  }
};

export const writeCachedPublicSettings = (settings) => {
  if (typeof localStorage === 'undefined' || !settings) {
    return;
  }

  try {
    localStorage.setItem(PUBLIC_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Espace local indisponible: on continue sans casser l'interface.
  }
};

export const hasAdminPreviewSession = () => {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const token = localStorage.getItem('adminAuthToken');
    const user = JSON.parse(localStorage.getItem('adminUser') || 'null');
    return Boolean(token && user && user.role === 'superadmin');
  } catch {
    return false;
  }
};

export const getMaintenanceSnapshot = (settings = {}, nowMs = Date.now()) => {
  const maintenanceEnd = parseDateLike(settings?.maintenance_end_at_iso || settings?.maintenance_end_at);
  const maintenanceEndMs = maintenanceEnd?.getTime() ?? null;
  const maintenanceActive = isTruthy(settings?.maintenance_mode)
    && (!maintenanceEndMs || nowMs < maintenanceEndMs);

  return {
    maintenanceActive,
    maintenanceEnd,
    maintenanceEndMs,
    maintenanceRemainingMs: maintenanceActive && maintenanceEndMs
      ? Math.max(0, maintenanceEndMs - nowMs)
      : 0,
  };
};

export const getVotingWindowSnapshot = (settings = {}, nowMs = Date.now()) => {
  const start = parseDateLike(settings?.vote_start_at_iso || settings?.vote_start_at, false);
  const rawEnd = parseDateLike(
    settings?.vote_end_at_effective_iso || settings?.vote_end_at_iso || settings?.vote_end_at,
    true,
  );
  const snapshotTime = parseDateLike(settings?.server_time);
  const {
    maintenanceActive,
    maintenanceEndMs,
  } = getMaintenanceSnapshot(settings, nowMs);

  const startMs = start?.getTime() ?? null;
  const rawEndMs = rawEnd?.getTime() ?? null;
  const snapshotTimeMs = snapshotTime?.getTime() ?? nowMs;
  const countdownPaused = Boolean(settings?.countdown_paused);
  const cachedRemainingMs = Number.isFinite(Number(settings?.countdown_remaining_seconds))
    ? Math.max(0, Number(settings.countdown_remaining_seconds) * 1000)
    : null;
  const totalMs = Number.isFinite(Number(settings?.countdown_total_seconds))
    ? Math.max(0, Number(settings.countdown_total_seconds) * 1000)
    : (rawEndMs && startMs ? Math.max(0, rawEndMs - startMs) : 0);

  let effectiveEndMs = rawEndMs;

  if (
    countdownPaused
    && rawEndMs
    && maintenanceEndMs
    && snapshotTimeMs < maintenanceEndMs
  ) {
    effectiveEndMs = rawEndMs + (maintenanceEndMs - snapshotTimeMs);
  }

  let remainingMs = effectiveEndMs ? Math.max(0, effectiveEndMs - nowMs) : 0;

  if (countdownPaused && maintenanceActive) {
    remainingMs = cachedRemainingMs ?? (rawEndMs ? Math.max(0, rawEndMs - snapshotTimeMs) : 0);
  }

  return {
    countdownPaused,
    start,
    startMs,
    snapshotTime,
    snapshotTimeMs,
    effectiveEnd: effectiveEndMs ? new Date(effectiveEndMs) : null,
    effectiveEndMs,
    totalMs,
    remainingMs,
  };
};

export const computePublicVotingState = (settings = {}, nowMs = Date.now()) => {
  const {
    maintenanceActive,
  } = getMaintenanceSnapshot(settings, nowMs);
  const {
    start,
    startMs,
    effectiveEndMs,
  } = getVotingWindowSnapshot(settings, nowMs);
  const votingOpen = settings?.voting_open !== false && isTruthy(settings?.voting_open ?? true);

  if (maintenanceActive) {
    return {
      maintenanceMode: true,
      votingBlocked: true,
      votingBlockReason: 'maintenance',
      votingBlockMessage: 'Plateforme en maintenance',
    };
  }

  if (!votingOpen) {
    return {
      maintenanceMode: false,
      votingBlocked: true,
      votingBlockReason: 'toggle_off',
      votingBlockMessage: 'Vote bloqué',
    };
  }

  if (startMs && nowMs < startMs) {
    return {
      maintenanceMode: false,
      votingBlocked: true,
      votingBlockReason: 'not_started',
      votingBlockMessage: 'Les votes ne sont pas encore ouverts',
    };
  }

  if (effectiveEndMs && nowMs > effectiveEndMs) {
    return {
      maintenanceMode: false,
      votingBlocked: true,
      votingBlockReason: 'ended',
      votingBlockMessage: 'Vote bloqué',
    };
  }

  return {
    maintenanceMode: false,
    votingBlocked: false,
    votingBlockReason: 'open',
    votingBlockMessage: 'Vote ouvert',
    start,
  };
};
