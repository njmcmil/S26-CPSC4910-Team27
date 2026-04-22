import type { ApiError } from '../types';

/** Same default as `.env.production` — used if the build has no env (e.g. misconfigured CI). */
const PRODUCTION_API_FALLBACK =
  'https://f8kqwmp227.execute-api.us-east-1.amazonaws.com';

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }
  return PRODUCTION_API_FALLBACK;
}

const BASE_URL = resolveApiBaseUrl();

/** Public base URL for fetch calls outside this module (e.g. file uploads). */
export const API_BASE_URL = BASE_URL;
const BLOCKED_STATE_KEY = 'gdip_blocked_state';

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

/** Register a callback invoked whenever any request returns 401 (e.g. expired token). */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let detail: string | undefined;
    let fieldErrors: Record<string, string> | undefined;

    try {
      const body = await res.json();
      if (typeof body.detail === 'string') {
        message = body.detail;
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
      detail = body.detail;
      fieldErrors = body.field_errors;
    } catch {
      // body wasn't JSON — keep default message
    }

    const detailText = typeof detail === 'string' ? detail : message;
    if (res.status === 403 && detailText.startsWith('ACCOUNT_BLOCKED:')) {
      const [, status = 'inactive', role = 'user'] = detailText.split(':');
      const friendlyMessage =
        status === 'banned'
          ? 'Your account has been banned. Please contact an administrator for review.'
          : 'Your account is currently inactive. Please contact an administrator for reactivation.';
      sessionStorage.setItem(
        BLOCKED_STATE_KEY,
        JSON.stringify({ status, role, message: friendlyMessage }),
      );
      if (window.location.pathname !== '/account-blocked') {
        window.location.replace('/account-blocked');
      }
    }

    const error: ApiError = { status: res.status, message, detail, fieldErrors };

    if (res.status === 401 && onUnauthorized && path !== '/login') {
      onUnauthorized();
    }

    throw error;
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
