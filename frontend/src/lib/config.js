const STORAGE_KEY = 'nar_backend_url';

const trimSlash = (value = '') => String(value).replace(/\/$/, '');

const readStorageUrl = () => {
  if (typeof window === 'undefined') return '';
  try {
    return trimSlash(localStorage.getItem(STORAGE_KEY) || '');
  } catch {
    return '';
  }
};

const readRuntimeConfig = () => {
  if (typeof window === 'undefined') return '';
  return trimSlash(window.__NAR_CONFIG__?.backendUrl || '');
};

const bakedUrl = trimSlash(
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  ''
);

export const getBackendUrl = () => (
  readStorageUrl() || readRuntimeConfig() || bakedUrl
);

export const BACKEND_URL = getBackendUrl();
export const SOCKET_URL = getBackendUrl() || undefined;

export const isApiConfigured = Boolean(getBackendUrl()) || Boolean(import.meta.env.DEV);

export const setBackendUrl = (value) => {
  const next = trimSlash(value);
  if (!next) {
    localStorage.removeItem(STORAGE_KEY);
    return '';
  }
  localStorage.setItem(STORAGE_KEY, next);
  return next;
};

export const apiUrl = (path = '') => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getBackendUrl()}${normalized}`;
};
