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

const getApiOrigin = () => getApiBaseUrl().replace(/\/api\/?$/, '');

const joinOriginAndPath = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${normalizedPath}`;
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
        return `${getApiOrigin()}${url.pathname}${url.search}${url.hash}`;
      }

      return trimmed;
    } catch {
      return trimmed;
    }
  }

  const normalized = trimmed.replace(/^\/+/, '');

  if (normalized.startsWith('public/storage/')) {
    return joinOriginAndPath(`/${normalized.replace(/^public\//, '')}`);
  }

  if (normalized.startsWith('storage/app/public/')) {
    return joinOriginAndPath(`/${normalized.replace(/^storage\/app\/public\//, 'storage/')}`);
  }

  if (trimmed.startsWith('/storage/')) {
    return joinOriginAndPath(trimmed);
  }

  if (trimmed.startsWith('storage/')) {
    return joinOriginAndPath(`/${trimmed}`);
  }

  if (normalized.startsWith('storage/')) {
    return joinOriginAndPath(`/${normalized}`);
  }

  return joinOriginAndPath(`/storage/${trimmed.replace(/^\/+/, '')}`);
};
