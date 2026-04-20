import { useCallback, useMemo, useState } from 'react';
import { publicAPI } from '../services/api';
import { PUBLIC_LIVE_UPDATE_INTERVAL_MS, useAutoRefresh } from '../utils/liveUpdates';
import {
  readCachedPublicInitData,
  readCachedPublicSettings,
  writeCachedPublicInitData,
  writeCachedPublicSettings,
} from '../utils/publicSettings';

const EMPTY_ARRAY = [];

export const usePublicBootstrapData = () => {
  const cachedInitData = useMemo(() => readCachedPublicInitData(), []);
  const cachedSettings = useMemo(
    () => cachedInitData?.settings || readCachedPublicSettings(),
    [cachedInitData],
  );

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

  const applyBootstrapPayload = useCallback((payload = {}) => {
    const nextSettings = payload?.settings || null;
    const nextCandidates = Array.isArray(payload?.candidates) ? payload.candidates : EMPTY_ARRAY;
    const nextStats = payload?.stats || null;
    const nextPartners = Array.isArray(payload?.partners) ? payload.partners : EMPTY_ARRAY;

    setPublicSettings(nextSettings);
    setPublicCandidates(nextCandidates);
    setPublicStats(nextStats);
    setPublicPartners(nextPartners);
    setBootstrapError(null);
    setBootstrapLoading(false);

    if (nextSettings) {
      writeCachedPublicSettings(nextSettings);
    }

    writeCachedPublicInitData({
      settings: nextSettings,
      candidates: nextCandidates,
      stats: nextStats,
      partners: nextPartners,
    });
  }, []);

  const fetchPublicBootstrap = useCallback(async () => {
    try {
      const payload = await publicAPI.getInitData();
      applyBootstrapPayload(payload);
    } catch (error) {
      setBootstrapError(error);
      setBootstrapLoading(false);
      console.error('Erreur chargement bootstrap public:', error);
    }
  }, [applyBootstrapPayload]);

  useAutoRefresh(fetchPublicBootstrap, {
    intervalMs: PUBLIC_LIVE_UPDATE_INTERVAL_MS,
    minGapMs: 30000,
    refreshOnFocus: false,
    refreshOnLiveUpdate: false,
    refreshOnStorage: false,
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
