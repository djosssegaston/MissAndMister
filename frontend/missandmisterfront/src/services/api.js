import {
  getOrderedTransportModes,
  isProductionProxyHost,
  rememberTransportMode,
} from '../utils/apiTransport';

const normalizeApiBaseUrl = (value) => {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return 'http://localhost:8000/api';
  }

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

const getRuntimeProxyApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return isProductionProxyHost(window.location.hostname) ? '/backend-api' : '';
};

const buildApiUrl = (baseUrl, endpoint) => `${baseUrl}${endpoint}`;

// Configuration de l'API
const DIRECT_API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL || 'http://localhost:8000/api');
const PROXY_API_BASE_URL = getRuntimeProxyApiBaseUrl();
const API_BASE_URL = PROXY_API_BASE_URL || DIRECT_API_BASE_URL;
const HEALTHCHECK_URL = `${DIRECT_API_BASE_URL.replace(/\/api$/i, '')}/up`;
export const SESSION_EXPIRED_EVENT = 'app:session-expired';
const PUBLIC_CACHE_STORAGE_KEY = 'mmub_public_api_cache_v1';
const PUBLIC_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6;
const CANDIDATE_PUBLIC_ENDPOINT_OUTAGE_KEY = 'mmub_candidate_public_endpoint_outage_until_v1';
const CANDIDATE_PUBLIC_ENDPOINT_OUTAGE_MS = 1000 * 60 * 15;

// Timeout global pour les appels API (en ms)
const API_TIMEOUT = (() => {
  const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS || '');
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout;
  }

  const isLocalApi = /(localhost|127\.0\.0\.1)/i.test(API_BASE_URL);
  return isLocalApi ? 10000 : 20000;
})();
const MAX_API_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SESSION_EXPIRED_MESSAGE = 'Votre session a expiré. Veuillez vous reconnecter pour continuer.';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getRequestMethod = (options = {}) => String(options.method || 'GET').toUpperCase();
const shouldSendJsonContentType = (method, body, hasFormData) => (
  !hasFormData
  && body !== undefined
  && body !== null
  && !['GET', 'HEAD'].includes(String(method || 'GET').toUpperCase())
);

// Construit proprement une query string à partir d'un objet de filtres
const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, value);
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

const isFormDataBody = (body) => typeof FormData !== 'undefined' && body instanceof FormData;
const getFirstValidationMessage = (errors = null) => {
  if (!errors || typeof errors !== 'object') return null;

  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && value.length > 0 && value[0]) return value[0];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return null;
};

const cleanHeaders = (headers = {}) => Object.fromEntries(
  Object.entries(headers).filter(([, value]) => value !== undefined && value !== null)
);

const isPublicReadEndpoint = (endpoint = '', method = 'GET') => {
  if (String(method || 'GET').toUpperCase() !== 'GET') {
    return false;
  }

  const normalizedEndpoint = String(endpoint || '');

  return normalizedEndpoint.startsWith('/public/')
    || normalizedEndpoint.startsWith('/candidates');
};

const getHttpErrorFallbackMessage = (status) => {
  if (status === 408) {
    return 'Le serveur met trop de temps à répondre. Réessayez dans quelques secondes.';
  }

  if (status === 429) {
    return 'Trop de requêtes sont en cours. Réessayez dans quelques instants.';
  }

  if (RETRYABLE_STATUS_CODES.has(status)) {
    return 'Le service est temporairement indisponible. Réessayez dans quelques secondes.';
  }

  return `Erreur ${status}`;
};

const readStoredJson = (key) => {
  if (typeof localStorage === 'undefined') return null;

  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

const readStoredNumber = (key) => {
  if (typeof sessionStorage === 'undefined') {
    return 0;
  }

  try {
    return Number(sessionStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};

const writeStoredNumber = (key, value) => {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(key, String(Number(value) || 0));
  } catch {
    // Ignore session storage write failures.
  }
};

const getPublicCacheKey = (endpoint = '') => `${PUBLIC_CACHE_STORAGE_KEY}:${endpoint}`;

const readCachedPublicResponse = (endpoint = '') => {
  if (typeof localStorage === 'undefined' || !endpoint) {
    return null;
  }

  try {
    const rawValue = localStorage.getItem(getPublicCacheKey(endpoint));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const savedAt = Number(parsed?.savedAt || 0);

    if (!savedAt || (Date.now() - savedAt) > PUBLIC_CACHE_MAX_AGE_MS) {
      localStorage.removeItem(getPublicCacheKey(endpoint));
      return null;
    }

    return parsed?.data ?? null;
  } catch {
    return null;
  }
};

const writeCachedPublicResponse = (endpoint = '', data = null) => {
  if (typeof localStorage === 'undefined' || !endpoint || data === undefined) {
    return;
  }

  try {
    localStorage.setItem(getPublicCacheKey(endpoint), JSON.stringify({
      savedAt: Date.now(),
      data,
    }));
  } catch {
    // Ignore storage quota or serialization issues.
  }
};

const getCurrentPathname = () => {
  if (typeof window === 'undefined') return '/';
  return window.location?.pathname || '/';
};

const getSessionScope = (endpoint = '', pathname = getCurrentPathname()) => {
  if (endpoint.startsWith('/admin') || pathname.startsWith('/admin')) {
    return 'admin';
  }

  return 'user';
};

export const getSessionLoginPath = (scope = null, pathname = getCurrentPathname()) => {
  if (scope === 'admin') {
    return '/admin/login';
  }

  if (scope === 'user') {
    return '/login';
  }

  if (pathname.startsWith('/admin')) {
    return '/admin/login';
  }

  const adminUser = readStoredJson('adminUser');
  if (adminUser?.role === 'admin' || adminUser?.role === 'superadmin') {
    return '/admin/login';
  }

  return '/login';
};

export const clearStoredSession = (scope = 'all') => {
  if (typeof localStorage === 'undefined') return;

  if (scope === 'all' || scope === 'user') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  if (scope === 'all' || scope === 'admin') {
    localStorage.removeItem('adminAuthToken');
    localStorage.removeItem('adminUser');
  }
};

const resolveAuthToken = (endpoint = '') => {
  if (typeof localStorage === 'undefined') return null;

  const scope = getSessionScope(endpoint);
  const userToken = localStorage.getItem('authToken');
  const adminToken = localStorage.getItem('adminAuthToken');

  return scope === 'admin'
    ? (adminToken || userToken)
    : (userToken || adminToken);
};

const dispatchSessionExpired = ({ scope = 'user', message = SESSION_EXPIRED_MESSAGE } = {}) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
    detail: {
      scope,
      message,
      title: 'Session expirée',
      loginPath: getSessionLoginPath(scope),
    },
  }));
};

const fetchWithTimeout = async (url, options = {}, timeout = API_TIMEOUT) => {
  const shouldTimeout = Number.isFinite(timeout) && timeout > 0;
  const controller = shouldTimeout ? new AbortController() : null;
  const id = shouldTimeout ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await fetch(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (id) clearTimeout(id);
    return response;
  } catch (error) {
    if (id) clearTimeout(id);
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Le serveur met trop de temps à répondre. Réessayez dans quelques secondes.');
      timeoutError.code = 'REQUEST_TIMEOUT';
      timeoutError.isRetryable = true;
      timeoutError.isNetworkError = true;
      throw timeoutError;
    }

    if (error instanceof TypeError || /Failed to fetch|Load failed|NetworkError/i.test(error.message || '')) {
      error.message = 'Impossible de contacter le serveur pour le moment. Reessayez dans quelques secondes.';
      error.isRetryable = true;
      error.isNetworkError = true;
    }

    throw error;
  }
};

const buildUnexpectedHtmlMessage = (html = '', title = '') => {
  const combinedContent = `${title}\n${html}`.trim();

  if (/LWS Protection DDoS|Protection DDoS|Verification|Vérification|Checking your browser|Anubis/i.test(combinedContent)) {
    return 'La protection reseau de l\'hebergeur a renvoye une page HTML au lieu des donnees attendues. Le site va essayer un autre chemin automatiquement.';
  }

  return 'Le serveur a renvoye une page HTML inattendue au lieu des donnees attendues.';
};

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
  );
};

const sanitizeApiMessage = (message = '', payload = null) => {
  const normalizedMessage = String(message || '').trim();
  const rawPayload = String(payload?._raw || '').trim();
  const combinedPreview = `${normalizedMessage}\n${rawPayload}`.trim();

  if (!combinedPreview) {
    return normalizedMessage;
  }

  if (
    looksLikeHtmlPayload(combinedPreview)
    || /LWS Protection DDoS|Protection DDoS|Verification|Vérification|Checking your browser|Anubis/i.test(combinedPreview)
  ) {
    return 'Impossible de contacter le serveur pour le moment. Reessayez dans quelques secondes.';
  }

  return normalizedMessage;
};

// Parsing robuste (gère HTML renvoyé par erreur en prod)
const parseResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (err) {
      // Fallback: traiter comme texte pour afficher un message exploitable
      const snippet = (text || '').trim().slice(0, 400) || 'Réponse vide';
      return { message: `Réponse JSON invalide`, detail: err.message, _raw: snippet };
    }
  }

  const trimmed = text?.trim() || '';
  const looksLikeHtml = looksLikeHtmlPayload(trimmed, contentType);

  if (looksLikeHtml) {
    const htmlTitle = (trimmed.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      message: buildUnexpectedHtmlMessage(trimmed, htmlTitle),
      detail: htmlTitle || null,
      _raw: trimmed.slice(0, 800),
      _isUnexpectedHtml: true,
      _isProtectionPage: /LWS Protection DDoS|Protection DDoS|Verification|Vérification|Checking your browser|Anubis/i.test(`${htmlTitle}\n${trimmed}`),
    };
  }

  // Réponse non JSON (souvent une page HTML d'erreur)
  if (!response.ok) {
    return {
      message: trimmed.slice(0, 200) || `Erreur HTTP ${response.status}`,
      _raw: trimmed,
    };
  }

  // Si c'est du texte mais status OK, on renvoie un objet enveloppe
  return { message: trimmed || 'Réponse texte vide', _raw: trimmed };
};

const buildApiError = (response, data) => {
  const validationMessage = getFirstValidationMessage(data?.errors);
  const rawMessage = data?.message || '';
  const preferredMessage = rawMessage && rawMessage !== 'The given data was invalid.'
    ? rawMessage
    : validationMessage;
  const fallbackMessage = getHttpErrorFallbackMessage(response.status);
  const sanitizedMessage = sanitizeApiMessage(preferredMessage || rawMessage || fallbackMessage, data);
  const error = new Error(sanitizedMessage || fallbackMessage);
  const isRetryableProxyFailure = response.headers.get('x-proxy-by') === 'vercel-backend-proxy'
    && RETRYABLE_STATUS_CODES.has(response.status);
  error.status = response.status;
  error.errors = data?.errors || null;
  error.detail = data?.detail || null;
  error.payload = data || null;
  error.validationMessage = validationMessage;
  error.isSessionExpired = response.status === 401;
  error.isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
  error.isTransportError = Boolean(data?._isUnexpectedHtml || data?._isProtectionPage || isRetryableProxyFailure);

  if (error.isTransportError || isRetryableProxyFailure) {
    error.isRetryable = true;
    error.isNetworkError = true;
  }

  return error;
};

const buildUnexpectedHtmlError = (response, data) => {
  const fallbackMessage = 'Impossible de contacter le serveur pour le moment. Reessayez dans quelques secondes.';
  const error = new Error(sanitizeApiMessage(data?.message || fallbackMessage, data) || fallbackMessage);
  error.status = response.status || 200;
  error.detail = data?.detail || null;
  error.payload = data || null;
  error.isRetryable = true;
  error.isNetworkError = true;
  error.isTransportError = true;
  return error;
};

const getAvailableApiBaseUrls = () => {
  const baseUrlsByMode = {
    proxy: PROXY_API_BASE_URL,
    direct: DIRECT_API_BASE_URL,
  };

  return getOrderedTransportModes(Object.keys(baseUrlsByMode))
    .map((mode) => ({ mode, baseUrl: baseUrlsByMode[mode] }))
    .filter(({ baseUrl }) => Boolean(baseUrl));
};

const rememberSuccessfulBaseUrl = (baseUrl) => {
  if (baseUrl === PROXY_API_BASE_URL) {
    rememberTransportMode('proxy');
    return;
  }

  if (baseUrl === DIRECT_API_BASE_URL) {
    rememberTransportMode('direct');
  }
};

const shouldRetryRequest = (method = 'GET', error, attempt, maxRetries = MAX_API_RETRIES) => {
  if (attempt >= maxRetries) {
    return false;
  }

  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (!RETRYABLE_METHODS.has(normalizedMethod)) {
    return false;
  }

  if (error?.status && RETRYABLE_STATUS_CODES.has(error.status)) {
    return true;
  }

  return Boolean(error?.isRetryable || error?.isNetworkError);
};

const shouldRetryAlternateAdminLoginEndpoint = (error) => {
  const status = Number(error?.status || 0);

  if (!status) {
    return Boolean(error?.isRetryable || error?.isNetworkError || error?.isTransportError);
  }

  return [404, 405, 408, 429, 500, 502, 503, 504].includes(status);
};

const wakeBackend = async () => {
  try {
    await fetchWithTimeout(HEALTHCHECK_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-store',
      },
    }, Math.min(API_TIMEOUT, 15000));
  } catch {
    // Le reveil du service est opportuniste: on laisse la requete principale gerer l'erreur finale.
  }
};

const LEGACY_CANDIDATES_PAGE_SIZE = 500;
const isCandidatePublicEndpointCoolingDown = () => readStoredNumber(CANDIDATE_PUBLIC_ENDPOINT_OUTAGE_KEY) > Date.now();
const rememberCandidatePublicEndpointFailure = () => {
  writeStoredNumber(CANDIDATE_PUBLIC_ENDPOINT_OUTAGE_KEY, Date.now() + CANDIDATE_PUBLIC_ENDPOINT_OUTAGE_MS);
};
const clearCandidatePublicEndpointFailure = () => {
  writeStoredNumber(CANDIDATE_PUBLIC_ENDPOINT_OUTAGE_KEY, 0);
};

const candidateMatchesIdentifier = (candidate = {}, identifier = '') => {
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier) {
    return false;
  }

  return [
    candidate.public_uid,
    candidate.slug,
    candidate.public_number,
    candidate.id,
  ].some((value) => String(value ?? '').trim() === normalizedIdentifier);
};

const fetchLegacyCandidatesPage = async (page = 1, filters = {}) => {
  const queryParams = new URLSearchParams({
    per_page: LEGACY_CANDIDATES_PAGE_SIZE,
    page,
    ...filters,
  }).toString();

  return fetchPublicAPI(`/candidates${queryParams ? `?${queryParams}` : ''}`, {
    timeout: 30000,
  });
};

const fetchLegacyCandidateByIdentifier = async (identifier) => {
  let page = 1;
  let lastPage = 1;

  do {
    const response = await fetchLegacyCandidatesPage(page);
    const candidates = Array.isArray(response?.data) ? response.data : [];
    const match = candidates.find((candidate) => candidateMatchesIdentifier(candidate, identifier));

    if (match) {
      return match;
    }

    const resolvedLastPage = Number(response?.last_page || 1);
    lastPage = Number.isFinite(resolvedLastPage) && resolvedLastPage > 0 ? resolvedLastPage : 1;
    page += 1;
  } while (page <= lastPage);

  const notFoundError = new Error('Candidate not found');
  notFoundError.status = 404;
  throw notFoundError;
};

const performApiRequest = async (endpoint, config, { timeout = API_TIMEOUT, maxRetries = MAX_API_RETRIES } = {}) => {
  const executeAgainstBaseUrl = async (baseUrl) => {
    const response = await fetchWithTimeout(buildApiUrl(baseUrl, endpoint), config, timeout);
    const data = await parseResponseBody(response);

    if (data?._isUnexpectedHtml) {
      throw buildUnexpectedHtmlError(response, data);
    }

    if (!response.ok) {
      throw buildApiError(response, data);
    }

    rememberSuccessfulBaseUrl(baseUrl);
    return data;
  };

  const executeParallelReadRequest = async (baseUrlCandidates) => {
    return new Promise((resolve, reject) => {
      const failures = [];
      let remaining = baseUrlCandidates.length;
      let settled = false;

      baseUrlCandidates.forEach(({ baseUrl }) => {
        executeAgainstBaseUrl(baseUrl)
          .then((data) => {
            if (settled) {
              return;
            }

            settled = true;
            resolve(data);
          })
          .catch((error) => {
            failures.push(error);
            remaining -= 1;

            if (settled || remaining > 0) {
              return;
            }

            const rankedFailure = failures.find((item) => item?.isTransportError || item?.isNetworkError)
              || failures.find((item) => item?.isRetryable)
              || failures[0]
              || new Error('Impossible de contacter le serveur pour le moment. Reessayez dans quelques secondes.');

            settled = true;
            reject(rankedFailure);
          });
      });
    });
  };

  for (let attempt = 0; ; attempt += 1) {
    let lastError = null;

    try {
      const baseUrlCandidates = getAvailableApiBaseUrls();
      const method = getRequestMethod(config);

      if (baseUrlCandidates.length > 1 && RETRYABLE_METHODS.has(method)) {
        return await executeParallelReadRequest(baseUrlCandidates);
      }

      for (let index = 0; index < baseUrlCandidates.length; index += 1) {
        const { baseUrl } = baseUrlCandidates[index];

        try {
          return await executeAgainstBaseUrl(baseUrl);
        } catch (error) {
          lastError = error;

          const hasAlternativeBaseUrl = index < baseUrlCandidates.length - 1;
          if (hasAlternativeBaseUrl && (error?.isTransportError || error?.isNetworkError)) {
            continue;
          }

          throw error;
        }
      }
    } catch (error) {
      const retryTarget = error || lastError;

      if (shouldRetryRequest(config.method, retryTarget, attempt, maxRetries)) {
        await wakeBackend();
        await sleep(800 * (attempt + 1));
        continue;
      }

      throw retryTarget;
    }
  }
};

// Fonction helper pour les requêtes publiques (sans auth)
const fetchPublicAPI = async (endpoint, options = {}) => {
  const { timeout = API_TIMEOUT, ...requestOptions } = options;
  const hasFormData = isFormDataBody(requestOptions.body);
  const method = getRequestMethod(requestOptions);
  const canUseCacheFallback = isPublicReadEndpoint(endpoint, method);
  const cachedResponse = canUseCacheFallback ? readCachedPublicResponse(endpoint) : null;
  const defaultHeaders = {
    'Accept': 'application/json',
    ...(shouldSendJsonContentType(method, requestOptions.body, hasFormData) ? { 'Content-Type': 'application/json' } : {}),
  };

  const config = {
    ...requestOptions,
    method,
    headers: {
      ...cleanHeaders(defaultHeaders),
      ...cleanHeaders(requestOptions.headers || {}),
    },
  };

  try {
    const data = await performApiRequest(endpoint, config, { timeout });

    if (canUseCacheFallback) {
      writeCachedPublicResponse(endpoint, data);
    }

    return data;
  } catch (error) {
    if (canUseCacheFallback && cachedResponse && (error?.isNetworkError || error?.isTransportError || error?.code === 'REQUEST_TIMEOUT')) {
      return cachedResponse;
    }

    console.error('API Error:', error);
    throw error;
  }
};

// Fonction helper pour les requêtes (avec auth si token existe)
const fetchAPI = async (endpoint, options = {}) => {
  const token = resolveAuthToken(endpoint);
  const { timeout = API_TIMEOUT, skipSessionExpiredHandling = false, ...requestOptions } = options;
  const hasFormData = isFormDataBody(requestOptions.body);
  const method = getRequestMethod(requestOptions);
  
  const defaultHeaders = {
    'Accept': 'application/json',
    ...(shouldSendJsonContentType(method, requestOptions.body, hasFormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const config = {
    ...requestOptions,
    method,
    headers: {
      ...cleanHeaders(defaultHeaders),
      ...cleanHeaders(requestOptions.headers || {}),
    },
  };

  try {
    return await performApiRequest(endpoint, config, { timeout });
  } catch (error) {
    if (error.status === 401) {
      const scope = getSessionScope(endpoint);
      error.message = SESSION_EXPIRED_MESSAGE;
      clearStoredSession(scope);
      if (!skipSessionExpiredHandling) {
        dispatchSessionExpired({ scope, message: error.message });
      }
    }

    console.error('API Error:', error);
    throw error;
  }
};

// ===== AUTHENTIFICATION =====
export const authAPI = {
  // Inscription
  register: async (userData) => {
    return fetchPublicAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Connexion
  login: async (credentials) => {
    return fetchPublicAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      timeout: 45000,
    });
  },

  adminLogin: async (credentials) => {
    const payload = JSON.stringify({
      ...credentials,
      scope: 'admin',
    });
    const candidateEndpoints = [
      '/admin/login',
      '/auth/admin-login',
      '/auth/login',
    ];

    let lastError = null;

    for (const endpoint of candidateEndpoints) {
      try {
        return await fetchPublicAPI(endpoint, {
          method: 'POST',
          body: payload,
          timeout: 45000,
        });
      } catch (error) {
        lastError = error;

        if (!shouldRetryAlternateAdminLoginEndpoint(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Impossible de contacter le serveur pour le moment. Reessayez dans quelques secondes.');
  },

  // Déconnexion
  logout: async () => {
    return fetchAPI('/auth/logout', {
      method: 'POST',
      skipSessionExpiredHandling: true,
    });
  },

  // Profil utilisateur
  getProfile: async () => {
    return fetchAPI('/auth/me');
  },

  // Mise à jour du profil
  updateProfile: async (userData) => {
    return fetchAPI('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  me: async () => {
    return fetchAPI('/auth/me');
  },

  changePassword: async (payload) => {
    return fetchAPI('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ===== CANDIDATS =====
export const candidatesAPI = {
  // Récupérer tous les candidats
  getAll: async (filters = {}) => {
    const queryParams = new URLSearchParams({ per_page: 500, ...filters }).toString();
    if (isCandidatePublicEndpointCoolingDown()) {
      return fetchLegacyCandidatesPage(1, filters);
    }

    try {
      const response = await fetchPublicAPI(`/public/candidates${queryParams ? `?${queryParams}` : ''}`, {
        timeout: 30000,
      });
      clearCandidatePublicEndpointFailure();
      return response;
    } catch (publicError) {
      rememberCandidatePublicEndpointFailure();
      console.warn('Public candidates endpoint failed, falling back to legacy endpoint.', publicError);
      return fetchLegacyCandidatesPage(1, filters);
    }
  },

  // Récupérer un candidat par identifiant public (slug / numero public)
  getById: async (identifier) => {
    if (isCandidatePublicEndpointCoolingDown()) {
      return fetchLegacyCandidateByIdentifier(identifier);
    }

    try {
      const response = await fetchPublicAPI(`/public/candidates/${encodeURIComponent(identifier)}`, {
        timeout: 30000,
      });
      clearCandidatePublicEndpointFailure();
      return response;
    } catch (publicError) {
      rememberCandidatePublicEndpointFailure();
      console.warn('Public candidate details endpoint failed, falling back to legacy candidates listing.', publicError);
      return fetchLegacyCandidateByIdentifier(identifier);
    }
  },

  // Récupérer les candidats par catégorie
  getByCategory: async (category) => {
    return fetchAPI(`/candidates?category=${category}`);
  },

  // Rechercher des candidats
  search: async (query) => {
    return fetchAPI(`/candidates/search?q=${encodeURIComponent(query)}`);
  },

  // Statistiques publiques
  getStats: async () => {
    return fetchPublicAPI('/public/stats', {
      timeout: 30000,
    });
  },
};

export const candidateAPI = {
  getDashboard: async () => {
    return fetchAPI('/candidate/dashboard', {
      timeout: 30000,
    });
  },
};

// ===== VOTES =====
export const votesAPI = {
  // Voter pour un candidat (public - sans auth)
  vote: async (candidateIdentifier, voteData) => {
    return fetchAPI('/votes', {
      method: 'POST',
      body: JSON.stringify({
        candidate_identifier: candidateIdentifier,
        amount: voteData.amount,
        quantity: voteData.quantity || 1,
        currency: 'XOF',
      }),
      timeout: 45000,
    });
  },

  // Historique des votes de l'utilisateur
  getUserVotes: async () => {
    return fetchAPI('/votes/history');
  },

  // Vérifier si l'utilisateur peut voter
  canVote: async (candidateId) => {
    return fetchAPI(`/votes/can-vote/${candidateId}`);
  },

  // Statistiques de votes
  getStats: async () => {
    return fetchAPI('/votes/stats');
  },
};

// ===== RÉSULTATS =====
export const resultsAPI = {
  // Récupérer les résultats
  getResults: async () => {
    return fetchAPI('/results');
  },

  // Récupérer le classement
  getRanking: async (category = null) => {
    return fetchAPI(`/results/ranking${category ? `?category=${category}` : ''}`);
  },
};

// ===== GALERIE =====
export const galleryAPI = {
  // Récupérer toutes les photos/vidéos
  getAll: async (params = {}) => {
    const query = buildQueryString(params);
    return fetchPublicAPI(`/public/gallery${query}`);
  },

  // Récupérer les médias par édition
  getByEdition: async (year) => {
    return fetchPublicAPI(`/public/gallery${buildQueryString({ year })}`);
  },
};

// ===== PARTENAIRES =====
export const partnersAPI = {
  getAll: async () => {
    return fetchPublicAPI('/public/partners');
  },
};

// ===== CONTACT =====
export const contactAPI = {
  // Envoyer un message de contact
  sendMessage: async (messageData) => {
    return fetchAPI('/contact', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  },
};

// ===== FAQ =====
export const faqAPI = {
  // Récupérer toutes les FAQs
  getAll: async () => {
    return fetchAPI('/faq');
  },
};

// ===== PAIEMENT =====
export const paymentAPI = {
  // Initier un paiement Mobile Money
  initiate: async (paymentData) => {
    return fetchAPI('/payment/initiate', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  // Vérifier le statut d'un paiement
  checkStatus: async (transactionId) => {
    return fetchAPI(`/payment/status/${transactionId}`);
  },

  // Historique des paiements
  getHistory: async () => {
    return fetchAPI('/payment/history');
  },

  // Synchroniser publiquement un paiement FedaPay a partir de sa reference
  syncPublic: async (reference) => {
    return fetchPublicAPI(`/payments/${encodeURIComponent(reference)}/sync`, {
      timeout: 30000,
    });
  },
};

// ===== ADMIN =====
export const adminAPI = {
  // Statistiques du dashboard
  getStats: async () => {
    return fetchAPI('/admin/dashboard/stats', {
      timeout: 30000,
    });
  },

  // Candidats (admin)
  getCandidates: async (params = {}) => {
    const query = buildQueryString({ per_page: 500, ...params });
    return fetchAPI(`/admin/candidates${query}`, {
      timeout: 30000,
    });
  },

  createCandidate: async (candidateData) => {
    return fetchAPI('/admin/candidates', {
      method: 'POST',
      body: JSON.stringify(candidateData),
    });
  },

  updateCandidate: async (id, candidateData) => {
    return fetchAPI(`/admin/candidates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(candidateData),
    });
  },

  deleteCandidate: async (id) => {
    return fetchAPI(`/admin/candidates/${id}`, {
      method: 'DELETE',
    });
  },

  toggleCandidateStatus: async (id, isActive) => {
    return fetchAPI(`/admin/candidates/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  // Utilisateurs (admin)
  getUsers: async (params = {}) => {
    const query = buildQueryString(params);
    return fetchAPI(`/admin/users${query}`, {
      timeout: 30000,
    });
  },

  updateUserStatus: async (id, status) => {
    return fetchAPI(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteUser: async (id) => {
    return fetchAPI(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Votes (admin)
  getVotes: async (params = {}) => {
    const query = buildQueryString(params);
    return fetchAPI(`/admin/votes${query}`, {
      timeout: 30000,
    });
  },

  updateVote: async (id, voteData) => {
    return fetchAPI(`/admin/votes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(voteData),
    });
  },

  deleteVote: async (id) => {
    return fetchAPI(`/admin/votes/${id}`, {
      method: 'DELETE',
    });
  },

  uploadCandidatePhoto: async (id, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return fetchAPI(`/admin/candidates/${id}/photo`, {
      method: 'POST',
      body: formData,
      timeout: 120000,
    });
  },

  uploadCandidateVideo: async (id, file) => {
    const formData = new FormData();
    formData.append('video', file);
    return fetchAPI(`/admin/candidates/${id}/video`, {
      method: 'POST',
      body: formData,
      timeout: 0,
    });
  },

  getGalleryItems: async () => {
    return fetchAPI('/admin/gallery', {
      timeout: 30000,
    });
  },

  createGalleryItem: async (payload) => {
    return fetchAPI('/admin/gallery', {
      method: 'POST',
      body: payload,
      timeout: 120000,
    });
  },

  updateGalleryItem: async (id, payload) => {
    payload.append('_method', 'PUT');
    return fetchAPI(`/admin/gallery/${id}`, {
      method: 'POST',
      body: payload,
      timeout: 120000,
    });
  },

  deleteGalleryItem: async (id) => {
    return fetchAPI(`/admin/gallery/${id}`, {
      method: 'DELETE',
    });
  },

  getPartners: async () => {
    return fetchAPI('/admin/partners', {
      timeout: 30000,
    });
  },

  createPartner: async (payload) => {
    return fetchAPI('/admin/partners', {
      method: 'POST',
      body: payload,
      timeout: 120000,
    });
  },

  updatePartner: async (id, payload) => {
    payload.append('_method', 'PUT');
    return fetchAPI(`/admin/partners/${id}`, {
      method: 'POST',
      body: payload,
      timeout: 120000,
    });
  },

  deletePartner: async (id) => {
    return fetchAPI(`/admin/partners/${id}`, {
      method: 'DELETE',
    });
  },

  // Catégories
  getCategories: async () => {
    return fetchAPI('/admin/categories');
  },

  createCategory: async (categoryData) => {
    return fetchAPI('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  updateCategory: async (id, categoryData) => {
    return fetchAPI(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  deleteCategory: async (id) => {
    return fetchAPI(`/admin/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Paramètres
  getSettings: async () => {
    return fetchAPI('/admin/settings');
  },

  updateSettings: async (settingsData) => {
    return fetchAPI('/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ settings: settingsData }),
    });
  },
};

// ===== SETTINGS (public) =====
export const settingsAPI = {
  getPublic: async () => {
    return fetchPublicAPI('/public/settings');
  },
};

// Export par défaut
export default {
  auth: authAPI,
  candidates: candidatesAPI,
  candidate: candidateAPI,
  votes: votesAPI,
  results: resultsAPI,
  gallery: galleryAPI,
  partners: partnersAPI,
  contact: contactAPI,
  faq: faqAPI,
  payment: paymentAPI,
  admin: adminAPI,
  settings: settingsAPI,
};
