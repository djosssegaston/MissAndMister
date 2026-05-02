const PRODUCTION_PROXY_HOSTS = new Set([
  'missmisteruniversitybenin.com',
  'www.missmisteruniversitybenin.com',
]);

const TRANSPORT_STORAGE_KEY = 'mmub_api_transport_mode_v3';
const VALID_TRANSPORT_MODES = new Set(['proxy', 'direct']);

const normalizeTransportMode = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_TRANSPORT_MODES.has(normalized) ? normalized : '';
};

const getRuntimeHostname = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location?.hostname || '';
};

export const isProductionProxyHost = (hostname = getRuntimeHostname()) => (
  PRODUCTION_PROXY_HOSTS.has(hostname)
  || String(hostname || '').endsWith('.vercel.app')
);

// In production we prefer the same-origin Vercel proxy first so the browser
// no longer talks directly to the shared-hosting API unless a fallback is needed.
export const getDefaultTransportMode = () => 'proxy';

export const getStoredTransportMode = () => {
  if (typeof sessionStorage === 'undefined') {
    return '';
  }

  try {
    return normalizeTransportMode(sessionStorage.getItem(TRANSPORT_STORAGE_KEY));
  } catch {
    return '';
  }
};

export const getPreferredTransportMode = () => (
  getStoredTransportMode() || getDefaultTransportMode()
);

export const rememberTransportMode = (mode) => {
  const normalized = normalizeTransportMode(mode);

  if (!normalized || typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(TRANSPORT_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures and continue with in-memory defaults.
  }
};

export const getOrderedTransportModes = (availableModes = []) => {
  const uniqueModes = [...new Set(
    availableModes
      .map((mode) => normalizeTransportMode(mode))
      .filter(Boolean)
  )];

  if (uniqueModes.length <= 1) {
    return uniqueModes;
  }

  const preferredMode = getPreferredTransportMode();
  const orderedModes = [];

  if (uniqueModes.includes(preferredMode)) {
    orderedModes.push(preferredMode);
  }

  uniqueModes.forEach((mode) => {
    if (!orderedModes.includes(mode)) {
      orderedModes.push(mode);
    }
  });

  return orderedModes;
};
