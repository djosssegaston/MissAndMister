import { useEffect, useRef } from 'react';

export const LIVE_UPDATE_EVENT = 'app:live-update';
export const LIVE_UPDATE_STORAGE_KEY = 'app_live_update';
export const LIVE_UPDATE_INTERVAL_MS = 5000;

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
  } = {},
) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const win = getWindow();
    if (!win || !enabled) {
      return undefined;
    }

    const runRefresh = () => {
      void callbackRef.current?.();
    };

    runRefresh();

    const intervalId = win.setInterval(runRefresh, intervalMs);
    const handleFocus = () => runRefresh();
    const handleLiveUpdate = () => runRefresh();
    const handleStorage = (event) => {
      if (event.key === LIVE_UPDATE_STORAGE_KEY || event.key === 'settings_updated_at') {
        runRefresh();
      }
    };

    win.addEventListener('focus', handleFocus);
    win.addEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
    win.addEventListener('settings-updated', handleLiveUpdate);
    win.addEventListener('storage', handleStorage);

    return () => {
      win.clearInterval(intervalId);
      win.removeEventListener('focus', handleFocus);
      win.removeEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
      win.removeEventListener('settings-updated', handleLiveUpdate);
      win.removeEventListener('storage', handleStorage);
    };
  }, [enabled, intervalMs]);
};
