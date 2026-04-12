const getApiBaseUrl = () => {
  const trimmed = String(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  const normalizedHost = trimmed
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

  return `https://${normalizedHost}/api`;
};

const getApiOrigin = () => getApiBaseUrl().replace(/\/api\/?$/, '');

const joinOriginAndPath = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${normalizedPath}`;
};

export const resolveMediaUrl = (value = '') => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);

      if (url.pathname.startsWith('/storage/')) {
        return `${getApiOrigin()}${url.pathname}${url.search}${url.hash}`;
      }

      return trimmed;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith('/storage/')) {
    return joinOriginAndPath(trimmed);
  }

  if (trimmed.startsWith('storage/')) {
    return joinOriginAndPath(`/${trimmed}`);
  }

  return joinOriginAndPath(`/storage/${trimmed.replace(/^\/+/, '')}`);
};
