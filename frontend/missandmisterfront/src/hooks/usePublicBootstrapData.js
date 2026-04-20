import { useCallback, useMemo, useRef, useState } from 'react';
import { publicAPI } from '../services/api';
import { NO_AUTO_REFRESH_INTERVAL_MS, useAutoRefresh } from '../utils/liveUpdates';
import {
  readCachedPublicInitData,
  readCachedPublicSettings,
  writeCachedPublicInitData,
  writeCachedPublicSettings,
} from '../utils/publicSettings';

const EMPTY_ARRAY = [];
const PUBLIC_UPDATE_CHECK_INTERVAL_MS = 15000;
const PUBLIC_UPDATE_ALLOWED_SCOPES = ['global', 'settings', 'candidates', 'partners'];

export const usePublicBootstrapData = () => {
  const cachedInitData = useMemo(() => readCachedPublicInitData(), []);
  const cachedSettings = useMemo(
    () => cachedInitData?.settings || readCachedPublicSettings(),
    [cachedInitData],
  );
  const cachedUpdateSignal = useMemo(() => {
    const signal = cachedInitData?.meta?.update_signal || {};

    return {
      version: Number(signal?.version || 0),
      timestamp: Number(signal?.timestamp || 0),
    };
  }, [cachedInitData]);

  const [publicSettings, setPublicSettings] = useState(cachedSettings || null);
  const [publicCandidates, setPublicCandidates] = useState(
    Array.isArray(cachedInitData?.candidates) ? cachedInitData.candidates : EMPTY_ARRAY,
  );
  const [publicStats, setPublicStats] = useState(cachedInitData?.stats || null);
  const [publicPartners, setPublicPartners] = useState(
    Array.isArray(cachedInitData?.partners) ? cachedInitData.partners : EMPTY_ARRAY,
  );
  const [bootstrapLoading, setBootstrapLoading] = useState(!cachedInitData);
  const [bootstrapError, setBootstrapError] = useState(null);
  const lastUpdateRef = useRef(cachedUpdateSignal);
  const bootstrapRequestRef = useRef(null);

  const applyBootstrapPayload = useCallback((payload = {}) => {
    const nextSettings = payload?.settings || null;
    const nextCandidates = Array.isArray(payload?.candidates) ? payload.candidates : EMPTY_ARRAY;
    const nextStats = payload?.stats || null;
    const nextPartners = Array.isArray(payload?.partners) ? payload.partners : EMPTY_ARRAY;
    const nextUpdateSignal = {
      version: Number(payload?.meta?.update_signal?.version || 0),
      timestamp: Number(payload?.meta?.update_signal?.timestamp || 0),
    };

    setPublicSettings(nextSettings);
    setPublicCandidates(nextCandidates);
    setPublicStats(nextStats);
    setPublicPartners(nextPartners);
    setBootstrapError(null);
    setBootstrapLoading(false);
    lastUpdateRef.current = nextUpdateSignal;

    if (nextSettings) {
      writeCachedPublicSettings(nextSettings);
    }

    writeCachedPublicInitData({
      settings: nextSettings,
      candidates: nextCandidates,
      stats: nextStats,
      partners: nextPartners,
      meta: {
        update_signal: nextUpdateSignal,
      },
    });
  }, []);

  const fetchPublicBootstrap = useCallback(async () => {
    if (bootstrapRequestRef.current) {
      return bootstrapRequestRef.current;
    }

    bootstrapRequestRef.current = (async () => {
      try {
        const payload = await publicAPI.getInitData();
        applyBootstrapPayload(payload);
      } catch (error) {
        setBootstrapError(error);
        setBootstrapLoading(false);
        console.error('Erreur chargement bootstrap public:', error);
      } finally {
        bootstrapRequestRef.current = null;
      }
    })();

    return bootstrapRequestRef.current;
  }, [applyBootstrapPayload]);

  useAutoRefresh(fetchPublicBootstrap, {
    intervalMs: NO_AUTO_REFRESH_INTERVAL_MS,
    minGapMs: 30000,
    refreshOnFocus: false,
    refreshOnLiveUpdate: false,
    refreshOnStorage: false,
  });

  const checkForPublicUpdate = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    try {
      const signal = await publicAPI.getLastUpdate();
      const nextVersion = Number(signal?.version || 0);
      const nextTimestamp = Number(signal?.timestamp || 0);

      if (
        nextVersion !== Number(lastUpdateRef.current?.version || 0)
        || nextTimestamp !== Number(lastUpdateRef.current?.timestamp || 0)
      ) {
        await fetchPublicBootstrap();
      }
    } catch (error) {
      console.error('Erreur vérification mise à jour publique:', error);
    }
  }, [fetchPublicBootstrap]);

  useAutoRefresh(checkForPublicUpdate, {
    intervalMs: PUBLIC_UPDATE_CHECK_INTERVAL_MS,
    minGapMs: 10000,
    runOnMount: false,
    refreshOnFocus: false,
    refreshOnLiveUpdate: true,
    refreshOnStorage: true,
    allowedScopes: PUBLIC_UPDATE_ALLOWED_SCOPES,
  });

  return useMemo(() => ({
    publicSettings,
    publicCandidates,
    publicStats,
    publicPartners,
    bootstrapLoading,
    bootstrapError,
    refreshPublicBootstrap: fetchPublicBootstrap,
  }), [
    bootstrapError,
    bootstrapLoading,
    fetchPublicBootstrap,
    publicCandidates,
    publicPartners,
    publicSettings,
    publicStats,
  ]);
};
