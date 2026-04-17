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

// Configuration de l'API
const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL || 'http://localhost:8000/api');
const API_ROOT_URL = API_BASE_URL.replace(/\/api$/i, '');
const HEALTHCHECK_URL = `${API_ROOT_URL}/up`;
export const SESSION_EXPIRED_EVENT = 'app:session-expired';

// Timeout global pour les appels API (en ms)
const API_TIMEOUT = (() => {
  const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS || '');
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout;
  }

  return /(onrender\.com\/api$|^\/backend-api$)/i.test(API_BASE_URL) ? 25000 : 10000;
})();
const MAX_API_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SESSION_EXPIRED_MESSAGE = 'Votre session a expiré. Veuillez vous reconnecter pour continuer.';

const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getUserAgent = () => {
  try {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'server';
  } catch {
    return 'server';
  }
};

// Génère un identifiant corrélable pour tracer les requêtes côté back/logs
const buildRequestId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const getHttpErrorFallbackMessage = (status) => {
  if (status === 408) {
    return 'Le serveur met trop de temps à répondre. Réessayez dans quelques secondes.';
  }

  if (status === 429) {
    return 'Trop de requêtes sont en cours. Réessayez dans quelques instants.';
  }

  if (RETRYABLE_STATUS_CODES.has(status)) {
    return 'Le backend est en train de démarrer ou temporairement indisponible. Réessayez dans quelques secondes.';
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
      const timeoutError = new Error('Le serveur met trop de temps à répondre. S\'il vient de se reveiller sur Render, reessayez dans quelques secondes.');
      timeoutError.code = 'REQUEST_TIMEOUT';
      timeoutError.isRetryable = true;
      timeoutError.isNetworkError = true;
      throw timeoutError;
    }

    if (error instanceof TypeError || /Failed to fetch|Load failed|NetworkError/i.test(error.message || '')) {
      error.isRetryable = true;
      error.isNetworkError = true;
    }

    throw error;
  }
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

  // Réponse non JSON (souvent une page HTML d'erreur)
  const trimmed = text?.trim() || '';
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

  const error = new Error(preferredMessage || rawMessage || getHttpErrorFallbackMessage(response.status));
  error.status = response.status;
  error.errors = data?.errors || null;
  error.detail = data?.detail || null;
  error.payload = data || null;
  error.validationMessage = validationMessage;
  error.isSessionExpired = response.status === 401;
  error.isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
  return error;
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

const performApiRequest = async (endpoint, config, { timeout = API_TIMEOUT, maxRetries = MAX_API_RETRIES } = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, config, timeout);
      const data = await parseResponseBody(response);

      if (!response.ok) {
        const error = buildApiError(response, data);
        if (shouldRetryRequest(config.method, error, attempt, maxRetries)) {
          await wakeBackend();
          await sleep(800 * (attempt + 1));
          continue;
        }

        throw error;
      }

      return data;
    } catch (error) {
      if (shouldRetryRequest(config.method, error, attempt, maxRetries)) {
        await wakeBackend();
        await sleep(800 * (attempt + 1));
        continue;
      }

      throw error;
    }
  }
};

// Fonction helper pour les requêtes publiques (sans auth)
const fetchPublicAPI = async (endpoint, options = {}) => {
  const { timeout = API_TIMEOUT, ...requestOptions } = options;
  const hasFormData = isFormDataBody(requestOptions.body);
  const defaultHeaders = {
    'Accept': 'application/json',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    ...(!hasFormData ? { 'Content-Type': 'application/json' } : {}),
  };

  const config = {
    ...requestOptions,
    method: requestOptions.method || 'GET',
    headers: {
      ...cleanHeaders(defaultHeaders),
      'X-Request-Id': buildRequestId(),
      ...cleanHeaders(requestOptions.headers || {}),
    },
  };

  try {
    return await performApiRequest(endpoint, config, { timeout });
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Fonction helper pour les requêtes (avec auth si token existe)
const fetchAPI = async (endpoint, options = {}) => {
  const token = resolveAuthToken(endpoint);
  const { timeout = API_TIMEOUT, skipSessionExpiredHandling = false, ...requestOptions } = options;
  const hasFormData = isFormDataBody(requestOptions.body);
  
  const defaultHeaders = {
    'Accept': 'application/json',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    ...(!hasFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token && { Authorization: `Bearer ${token}` }),
    'X-Client-Timezone': getTimezone(),
    'X-Client-UA': getUserAgent(),
  };

  const config = {
    ...requestOptions,
    method: requestOptions.method || 'GET',
    headers: {
      ...cleanHeaders(defaultHeaders),
      'X-Request-Id': buildRequestId(),
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
    });
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
    return fetchPublicAPI(`/public/candidates${queryParams ? `?${queryParams}` : ''}`);
  },

  // Récupérer un candidat par identifiant public (slug / numero public)
  getById: async (identifier) => {
    return fetchPublicAPI(`/public/candidates/${encodeURIComponent(identifier)}`);
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
    return fetchPublicAPI('/public/stats');
  },
};

export const candidateAPI = {
  getDashboard: async () => {
    return fetchAPI('/candidate/dashboard');
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
    return fetchPublicAPI(`/payments/${encodeURIComponent(reference)}/sync`);
  },
};

// ===== ADMIN =====
export const adminAPI = {
  // Statistiques du dashboard
  getStats: async () => {
    return fetchAPI('/admin/dashboard/stats');
  },

  // Candidats (admin)
  getCandidates: async (params = {}) => {
    const query = buildQueryString({ per_page: 500, ...params });
    return fetchAPI(`/admin/candidates${query}`);
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
    return fetchAPI(`/admin/users${query}`);
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
    return fetchAPI(`/admin/votes${query}`);
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
    return fetchAPI('/admin/gallery');
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
    return fetchAPI('/admin/partners');
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
