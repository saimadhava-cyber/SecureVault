/**
 * SecureVault API Client with JWT Auth & Session Interception
 */

const rawEnvUrl =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : '';

function resolveApiBase() {
  if (!rawEnvUrl) {
    return '/api';
  }
  const clean = rawEnvUrl.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

const API_BASE = resolveApiBase();

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let onUnauthorizedCallback = null;

export function setUnauthorizedHandler(callback) {
  onUnauthorizedCallback = callback;
}

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('vault_token');
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If payload is not FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  // Handle unauthorized / expired session
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback(errorData);
    }
    throw new ApiError(errorData.error || 'Session expired. Please log in again.', 401, errorData.code);
  }

  // Handle errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || `Request failed with status ${response.status}`, response.status, errorData.code);
  }

  // If download endpoint returning blob
  if (options.asBlob) {
    return response.blob();
  }

  return response.json();
}
