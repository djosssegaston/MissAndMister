import { useEffect, useRef } from 'react';

export const LIVE_UPDATE_EVENT = 'app:live-update';
export const LIVE_UPDATE_STORAGE_KEY = 'app_live_update';
export const LIVE_UPDATE_INTERVAL_MS = 120000;
export const ADMIN_LIVE_UPDATE_INTERVAL_MS = 120000;
export const ADMIN_REALTIME_INTERVAL_MS = 90000;
export const PUBLIC_LIVE_UPDATE_INTERVAL_MS = 120000;

const getWindow = () => (typeof window === 'undefined' ? null : window);

export const broadcastLiveUpdate = (scope = 'global') => {
  const win = getWindow();
  const payload = {
    scope,
    at: Date.now(),
  };

  if (!win) {
    return payload;
  }

  try {
    win.localStorage.setItem(LIVE_UPDATE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignored: refresh still propagates through the in-page event.
  }

  win.dispatchEvent(new CustomEvent(LIVE_UPDATE_EVENT, { detail: payload }));
  return payload;
};

export const useAutoRefresh = (
  callback,
  {
    enabled = true,
    intervalMs = LIVE_UPDATE_INTERVAL_MS,
    minGapMs = 0,
    runOnMount = true,
    refreshOnFocus = true,
    refreshOnLiveUpdate = true,
    refreshOnStorage = true,
    allowedScopes = null,
  } = {},
) => {
  const callbackRef = useRef(callback);
  const inFlightRef = useRef(false);
  const lastRunAtRef = useRef(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const win = getWindow();
    if (!win || !enabled) {
      return undefined;
    }

    const normalizedScopes = Array.isArray(allowedScopes)
      ? allowedScopes
        .map((scope) => String(scope || '').trim().toLowerCase())
        .filter(Boolean)
      : (typeof allowedScopes === 'string' && allowedScopes.trim() !== ''
        ? [allowedScopes.trim().toLowerCase()]
        : []);
    const hasScopeFilter = normalizedScopes.length > 0;
    const shouldRunForScope = (scope) => {
      if (!hasScopeFilter) {
        return true;
      }

      const normalizedScope = String(scope || 'global').trim().toLowerCase();
      return normalizedScopes.includes(normalizedScope) || normalizedScopes.includes('global');
    };
    const runRefresh = async (force = false) => {
      const now = Date.now();

      if (inFlightRef.current) {
        return;
      }

      if (!force && minGapMs > 0 && (now - lastRunAtRef.current) < minGapMs) {
        return;
      }

      inFlightRef.current = true;

      try {
        await callbackRef.current?.();
        lastRunAtRef.current = Date.now();
      } finally {
        inFlightRef.current = false;
      }
    };

    if (runOnMount) {
      void runRefresh(true);
    }

    const hasInterval = Number.isFinite(intervalMs) && intervalMs > 0;
    const intervalId = hasInterval
      ? win.setInterval(() => {
        void runRefresh();
      }, intervalMs)
      : null;
    const handleFocus = () => {
      if (refreshOnFocus) {
        void runRefresh();
      }
    };
    const handleLiveUpdate = (event) => {
      if (!refreshOnLiveUpdate || !shouldRunForScope(event?.detail?.scope)) {
        return;
      }

      void runRefresh();
    };
    const handleStorage = (event) => {
      if (!refreshOnStorage) {
        return;
      }

      if (event.key === LIVE_UPDATE_STORAGE_KEY || event.key === 'settings_updated_at') {
        void runRefresh();
      }
    };

    if (refreshOnFocus) {
      win.addEventListener('focus', handleFocus);
    }
    if (refreshOnLiveUpdate) {
      win.addEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
      win.addEventListener('settings-updated', handleLiveUpdate);
    }
    if (refreshOnStorage) {
      win.addEventListener('storage', handleStorage);
    }

    return () => {
      if (intervalId !== null) {
        win.clearInterval(intervalId);
      }
      if (refreshOnFocus) {
        win.removeEventListener('focus', handleFocus);
      }
      if (refreshOnLiveUpdate) {
        win.removeEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
        win.removeEventListener('settings-updated', handleLiveUpdate);
      }
      if (refreshOnStorage) {
        win.removeEventListener('storage', handleStorage);
      }
    };
  }, [
    allowedScopes,
    enabled,
    intervalMs,
    minGapMs,
    refreshOnFocus,
    refreshOnLiveUpdate,
    refreshOnStorage,
    runOnMount,
  ]);
};
