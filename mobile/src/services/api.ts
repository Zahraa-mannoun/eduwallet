import * as storage from '../utils/storage';
import type { ApiResponse } from '../types/api';

export const API_BASE_URL = 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'eduwallet_access_token';
const REFRESH_TOKEN_KEY = 'eduwallet_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return storage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return storage.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await storage.removeItem(ACCESS_TOKEN_KEY);
  await storage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

let pendingRefresh: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json()) as ApiResponse<{ accessToken: string }>;

    if (!res.ok || !json.success) {
      await clearTokens();
      return null;
    }

    await setTokens(json.data.accessToken, refreshToken);
    return json.data.accessToken;
  } catch {
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!pendingRefresh) {
    pendingRefresh = performRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
  formData?: FormData;
};

function buildQueryString(query: ApiRequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function performFetch(
  path: string,
  options: ApiRequestOptions,
  token: string | null
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (options.formData) {
    requestBody = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(options.body);
  }

  return fetch(`${API_BASE_URL}${path}${buildQueryString(options.query)}`, {
    method: options.method ?? 'GET',
    headers,
    body: requestBody,
  });
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  const token = useAuth ? await getAccessToken() : null;

  let res: Response;
  try {
    res = await performFetch(path, options, token);
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', 0);
  }

  if (res.status === 401 && useAuth && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      try {
        res = await performFetch(path, options, newToken);
      } catch {
        throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', 0);
      }
    }
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    json = null;
  }

  if (!json) {
    throw new ApiError('Unexpected response from the server.', 'UNKNOWN_ERROR', res.status);
  }
  if (!json.success) {
    throw new ApiError(json.error, json.code, res.status);
  }
  return json.data;
}
