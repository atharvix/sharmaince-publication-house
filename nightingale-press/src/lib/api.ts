import type { ApiUser } from '../types/api';

// Relative by default: in production nginx serves the API on the same origin.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
const ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

/** Resolves a server-relative asset path (e.g. an uploaded cover image) against the API origin. */
export function resolveAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${ORIGIN}${path}`;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

interface AuthHooks {
  onRefreshed: (user: ApiUser, token: string) => void;
  onRefreshFailed: () => void;
}
let hooks: AuthHooks | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setAuthHooks(next: AuthHooks) {
  hooks = next;
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one
 * request — the server rotates the refresh token on every use.
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!res.ok) throw new Error('refresh failed');
        const data = (await res.json()) as { user: ApiUser; accessToken: string };
        accessToken = data.accessToken;
        hooks?.onRefreshed(data.user, data.accessToken);
        return true;
      } catch {
        accessToken = null;
        hooks?.onRefreshFailed();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  skipAuthRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuthRetry } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await send(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuthRetry && path !== '/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, { ...options, skipAuthRetry: true });
  }

  return parseResponse<T>(res, 'Something went wrong. Please try again.');
}

/** fetch, with network failures turned into an ApiError the UI can show. */
async function send(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }
}

async function parseResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: { error?: { code: string; message: string; details?: unknown } } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON — e.g. a proxy's HTML error page. Fall through to the generic error.
  }

  if (!res.ok) {
    const error = data?.error ?? { code: 'UNKNOWN', message: fallbackMessage };
    throw new ApiError(res.status, error.code, error.message, error.details);
  }
  if (data === null && text) throw new ApiError(res.status, 'BAD_RESPONSE', fallbackMessage);

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

async function uploadRequest<T>(path: string, fieldName: string, file: File, skipAuthRetry = false): Promise<T> {
  const form = new FormData();
  form.append(fieldName, file);

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await send(`${BASE_URL}${path}`, { method: 'POST', headers, credentials: 'include', body: form });

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return uploadRequest<T>(path, fieldName, file, true);
  }

  return parseResponse<T>(res, 'Upload failed. Please try again.');
}

/** Uploads a single file as multipart form data under `fieldName` (handles the same 401-refresh-retry as `api.*`). */
export const apiUpload = {
  post: <T>(path: string, fieldName: string, file: File) => uploadRequest<T>(path, fieldName, file),
};
