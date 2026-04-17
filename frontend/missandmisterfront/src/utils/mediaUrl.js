const getApiBaseUrl = () => {
  const trimmed = String(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').trim();

  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  const normalizedHost = trimmed
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

  return `https://${normalizedHost}/api`;
};

const PRODUCTION_PROXY_HOSTS = new Set([
  'missmisteruniversitybenin.com',
  'www.missmisteruniversitybenin.com',
]);

const getRuntimeMediaProxyBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return PRODUCTION_PROXY_HOSTS.has(window.location.hostname) ? '/backend-media' : '';
};

const getApiOrigin = () => getApiBaseUrl().replace(/\/api\/?$/, '');

const joinOriginAndPath = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${normalizedPath}`;
};

const buildPublicMediaUrl = (path = '') => {
  const normalizedPath = String(path).replace(/^\/+/, '');
  const strippedStoragePrefix = normalizedPath.replace(/^storage\/+/, '');

  const proxyBaseUrl = getRuntimeMediaProxyBaseUrl();
  if (proxyBaseUrl) {
    return `${proxyBaseUrl}/${strippedStoragePrefix}`;
  }

  return joinOriginAndPath(`/api/public/media/${strippedStoragePrefix}`);
};

export const resolveMediaUrl = (value = '') => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);

      if (url.pathname.startsWith('/storage/')) {
        return `${buildPublicMediaUrl(url.pathname)}${url.search}${url.hash}`;
      }

      if (url.pathname.startsWith('/api/public/media/')) {
        const proxyBaseUrl = getRuntimeMediaProxyBaseUrl();
        if (proxyBaseUrl) {
          return `${proxyBaseUrl}/${url.pathname.replace(/^\/api\/public\/media\//, '')}${url.search}${url.hash}`;
        }
      }

      return trimmed;
    } catch {
      return trimmed;
    }
  }

  const normalized = trimmed.replace(/^\/+/, '');

  if (normalized.startsWith('public/storage/')) {
    return buildPublicMediaUrl(normalized.replace(/^public\/storage\//, ''));
  }

  if (normalized.startsWith('storage/app/public/')) {
    return buildPublicMediaUrl(normalized.replace(/^storage\/app\/public\//, ''));
  }

  if (trimmed.startsWith('/storage/')) {
    return buildPublicMediaUrl(trimmed);
  }

  if (trimmed.startsWith('storage/')) {
    return buildPublicMediaUrl(trimmed);
  }

  if (normalized.startsWith('storage/')) {
    return buildPublicMediaUrl(normalized);
  }

  return buildPublicMediaUrl(trimmed);
};
