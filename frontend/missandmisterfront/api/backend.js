const UPSTREAM_API_BASE_URL = 'https://api.missmisteruniversitybenin.com/api';
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const PUBLIC_CACHE_CONTROL = 'public, s-maxage=120, stale-while-revalidate=86400';
const DYNAMIC_PUBLIC_CACHE_CONTROL = 'public, s-maxage=5, stale-while-revalidate=30';
const PRIVATE_CACHE_CONTROL = 'no-store';
const REQUEST_TIMEOUT_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryStatus = (status) => RETRYABLE_STATUS_CODES.has(Number(status || 0));
const isCacheablePublicRequest = (method, path) => method === 'GET' && String(path || '').startsWith('public/');
const usesDynamicPublicCache = (path = '') => (
  /^public\/(candidates(?:\/|$)|stats(?:\/|$)|settings(?:\/|$))/i.test(String(path || ''))
);
const expectsJsonPayload = (path) => (
  String(path || '').startsWith('public/')
  || /^payments\/[^/]+\/sync$/i.test(String(path || ''))
);

const looksLikeHtmlPayload = (text = '', contentType = '') => {
  const normalizedText = String(text || '').trim();
  const normalizedContentType = String(contentType || '').toLowerCase();
  const preview = normalizedText.slice(0, 600).toLowerCase();

  if (!normalizedText) {
    return false;
  }

  if (
    normalizedContentType.includes('text/html')
    || normalizedContentType.includes('application/xhtml+xml')
  ) {
    return true;
  }

  return (
    /^<!doctype html/i.test(normalizedText)
    || /^<html[\s>]/i.test(normalizedText)
    || preview.includes('<html')
    || preview.includes('<head')
    || preview.includes('<body')
    || preview.includes('<title')
    || preview.includes('<meta charset')
    || /lws protection ddos|checking your browser|verification|vérification|anubis/i.test(preview)
  );
};

const buildUpstreamUrl = (requestUrl) => {
  const url = new URL(requestUrl);
  const upstreamPath = String(url.searchParams.get('path') || '')
    .replace(/^\/+/, '')
    .trim();

  const upstreamUrl = new URL(`${UPSTREAM_API_BASE_URL}/${upstreamPath}`);

  url.searchParams.forEach((value, key) => {
    if (key === 'path') {
      return;
    }

    upstreamUrl.searchParams.append(key, value);
  });

  return { upstreamUrl, upstreamPath };
};

const buildProxyRequestHeaders = (request) => {
  const headers = new Headers();
  const passthroughHeaders = [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'if-none-match',
    'if-modified-since',
    'cache-control',
    'pragma',
    'x-requested-with',
  ];

  passthroughHeaders.forEach((headerName) => {
    const value = request.headers.get(headerName);

    if (value) {
      headers.set(headerName, value);
    }
  });

  headers.set('user-agent', 'MMUB-Vercel-Proxy/1.0');
  return headers;
};

const buildResponseHeaders = (upstreamResponse, cacheControl) => {
  const headers = new Headers();
  const passthroughHeaders = [
    'content-type',
    'etag',
    'last-modified',
    'content-language',
  ];

  passthroughHeaders.forEach((headerName) => {
    const value = upstreamResponse.headers.get(headerName);

    if (value) {
      headers.set(headerName, value);
    }
  });

  headers.set('cache-control', cacheControl);
  headers.set('x-proxy-by', 'vercel-backend-proxy');
  return headers;
};

const getPublicCacheControl = (path = '') => (
  usesDynamicPublicCache(path) ? DYNAMIC_PUBLIC_CACHE_CONTROL : PUBLIC_CACHE_CONTROL
);

const fetchWithTimeout = async (url, init, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const proxyRequest = async (request) => {
  const method = String(request.method || 'GET').toUpperCase();
  const { upstreamUrl, upstreamPath } = buildUpstreamUrl(request.url);
  const cacheablePublicRequest = isCacheablePublicRequest(method, upstreamPath);
  const retryableReadRequest = method === 'GET' || method === 'HEAD';
  const maxAttempts = retryableReadRequest ? 3 : 1;
  const requestHeaders = buildProxyRequestHeaders(request);
  const hasRequestBody = !['GET', 'HEAD'].includes(method);

  let lastFailure = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const upstreamResponse = await fetchWithTimeout(upstreamUrl, {
        method,
        headers: requestHeaders,
        body: hasRequestBody ? request.body : undefined,
        ...(hasRequestBody ? { duplex: 'half' } : {}),
      });

      const contentType = upstreamResponse.headers.get('content-type') || '';
      const cacheControl = cacheablePublicRequest ? getPublicCacheControl(upstreamPath) : PRIVATE_CACHE_CONTROL;

      if (expectsJsonPayload(upstreamPath)) {
        const text = await upstreamResponse.text();

        if (looksLikeHtmlPayload(text, contentType)) {
          lastFailure = new Error('Unexpected HTML challenge response from upstream.');

          if (retryableReadRequest && attempt < maxAttempts) {
            await sleep(300 * attempt);
            continue;
          }

          return new Response(JSON.stringify({
            message: 'Impossible de contacter le serveur pour le moment. Reessayez dans quelques secondes.',
          }), {
            status: 503,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': PRIVATE_CACHE_CONTROL,
              'x-proxy-by': 'vercel-backend-proxy',
            },
          });
        }

        if (shouldRetryStatus(upstreamResponse.status) && retryableReadRequest && attempt < maxAttempts) {
          await sleep(300 * attempt);
          continue;
        }

        return new Response(text, {
          status: upstreamResponse.status,
          headers: buildResponseHeaders(upstreamResponse, cacheControl),
        });
      }

      if (shouldRetryStatus(upstreamResponse.status) && retryableReadRequest && attempt < maxAttempts) {
        await sleep(300 * attempt);
        continue;
      }

      const body = await upstreamResponse.arrayBuffer();

      return new Response(body, {
        status: upstreamResponse.status,
        headers: buildResponseHeaders(upstreamResponse, cacheControl),
      });
    } catch (error) {
      lastFailure = error;

      if (retryableReadRequest && attempt < maxAttempts) {
        await sleep(300 * attempt);
        continue;
      }
    }
  }

  const status = lastFailure?.name === 'AbortError' ? 504 : 503;

  return new Response(JSON.stringify({
    message: 'Impossible de contacter le serveur pour le moment. Reessayez dans quelques secondes.',
  }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': PRIVATE_CACHE_CONTROL,
      'x-proxy-by': 'vercel-backend-proxy',
    },
  });
};

export default {
  async fetch(request) {
    return proxyRequest(request);
  },
};
