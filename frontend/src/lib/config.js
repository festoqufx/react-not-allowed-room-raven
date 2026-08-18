const trimSlash = (value = '') => String(value).replace(/\/$/, '');

const explicitUrl = trimSlash(import.meta.env.VITE_BACKEND_URL || '');

// Prefer same-origin in the browser so Vite's /api and /socket.io proxies work in local
// development and reverse-proxied production setups. Set VITE_BACKEND_URL only when the
// API is hosted on a different origin.
export const BACKEND_URL = explicitUrl;
export const SOCKET_URL = explicitUrl || undefined;

export const apiUrl = (path = '') => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${normalized}`;
};

export const isApiConfigured = Boolean(BACKEND_URL) || import.meta.env.DEV;
