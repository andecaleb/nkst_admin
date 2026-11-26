import type { ApiResult, JsonApiErrorResponse, JsonApiSuccess } from '@/types/api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:8080/api/v1';

const ACCESS_TOKEN_KEY = 'nkst_admin_access_token';
const REFRESH_TOKEN_KEY = 'nkst_admin_refresh_token';

export class ApiError extends Error {
  status: number;
  title: string;
  details: string[];

  constructor(status: number, message: string, title = 'Request Failed', details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.details = details.length > 0 ? details : [message];
  }
}

export const tokenStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken: string, refreshToken: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

function parseErrorResponse(status: number, body: JsonApiErrorResponse | null): ApiError {
  if (body?.errors && Array.isArray(body.errors) && body.errors.length > 0) {
    const details = body.errors
      .map((e) => e.detail || e.title)
      .filter((msg): msg is string => Boolean(msg));
    const first = body.errors[0];
    return new ApiError(
      status,
      details.join('; ') || 'An unexpected error occurred',
      first?.title || 'Request Failed',
      details,
    );
  }
  if (body?.message) {
    const details = Array.isArray(body.message) ? body.message : [body.message];
    return new ApiError(status, details.join('; '), 'Request Failed', details);
  }
  return new ApiError(status, `Request failed with status ${status}`);
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokenStorage.clear();
        return null;
      }
      const json = (await res.json()) as JsonApiSuccess<{
        accessToken: string;
        refreshToken: string;
      }>;
      const tokens = json.data;
      if (tokens?.accessToken && tokens?.refreshToken) {
        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      }
      tokenStorage.clear();
      return null;
    } catch {
      tokenStorage.clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
  _retried?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, params, skipAuth = false, _retried = false } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (!skipAuth) {
    const token = tokenStorage.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      0,
      `Unable to reach NKST API at ${API_BASE_URL}. Please ensure the backend service is running.`,
      'Network Error',
    );
  }

  if (response.status === 401 && !skipAuth && !_retried) {
    const newAccessToken = await attemptTokenRefresh();
    if (newAccessToken) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
  }

  let json: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('application/vnd.api+json')) {
    try {
      json = await response.json();
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    throw parseErrorResponse(response.status, json as JsonApiErrorResponse | null);
  }

  const envelope = json as JsonApiSuccess<T> | null;
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return {
      data: envelope.data,
      meta: envelope.meta,
    };
  }

  return { data: json as T };
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params'], skipAuth = false) =>
    apiRequest<T>(path, { method: 'GET', params, skipAuth }),
  post: <T>(path: string, body?: unknown, skipAuth = false) =>
    apiRequest<T>(path, { method: 'POST', body, skipAuth }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  baseUrl: API_BASE_URL,
};
