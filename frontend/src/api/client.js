/**
 * AVEKSHA NETRA — Centralized API Client
 * 
 * Single source of truth for all backend communications.
 * Respects VITE_API_URL (Cloudflare Tunnel / production domain)
 * with automatic fallback to local backend.
 */

// Base URL configuration (no trailing slash)
const RAW_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

/**
 * Returns stored auth token if present.
 */
export function getAuthToken() {
  try {
    return localStorage.getItem("aveksha_token");
  } catch {
    return null;
  }
}

/**
 * Builds full URL from endpoint path.
 * @param {string} path e.g. "/api/health" or "api/health"
 */
export function getApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

/**
 * Helper to construct streaming URLs (MJPEG) for <img> src
 * @param {string} path e.g. "/api/cameras/1/ai-stream"
 */
export function getStreamUrl(path) {
  return getApiUrl(path);
}

/**
 * Generic request helper with timeout and auth header injection.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = getApiUrl(endpoint);
  const token = getAuthToken();

  const headers = {
    "Accept": "application/json",
    ...options.headers,
  };

  // Attach Content-Type if sending a body and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Attach Bearer token if available
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data = await response.text();
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const errorMessage =
        (data && typeof data === "object" && (data.detail || data.message || data.error)) ||
        (typeof data === "string" && data) ||
        `Request failed with status ${response.status} (${response.statusText})`;
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    // Network errors, DNS failures, CORS rejection, or server offline
    if (!err.status) {
      err.isNetworkError = true;
      const raw = String(err.message || "").toLowerCase();
      if (!raw || raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("load failed")) {
        err.message = "Authentication service unavailable. Please verify the backend connection and try again.";
      }
    }
    throw err;
  }
}

export const apiClient = {
  get: (endpoint, options) => apiRequest(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options) =>
    apiRequest(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (endpoint, body, options) =>
    apiRequest(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (endpoint, options) => apiRequest(endpoint, { ...options, method: "DELETE" }),
  getApiUrl,
  getStreamUrl,
  API_BASE,
};

export default apiClient;
