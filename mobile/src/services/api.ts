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

// Lets AuthContext react to a mid-session suspension (an admin suspends the account while the
// user is already logged in) from wherever it's actually detected — every authenticated
// request funnels through apiRequest below, not just login. AuthContext registers itself on
// mount; screens that hit this error otherwise just see it as a normal thrown ApiError.
type AccountSuspendedHandler = (reason: string) => void;
let onAccountSuspended: AccountSuspendedHandler | null = null;

export function setAccountSuspendedHandler(handler: AccountSuspendedHandler | null): void {
  onAccountSuspended = handler;
}

// Distinguishes "the refresh token is genuinely invalid/missing" (session really is over) from
// "couldn't even reach the server to ask" (network hiccup — the stored tokens may still be
// perfectly valid). Conflating these used to make a flaky connection during token refresh look
// identical to an expired session, which is what caused AuthContext's cold-start check to log
// the user out on nothing more than a slow network.
type RefreshOutcome = { accessToken: string } | { networkError: true } | { invalid: true };

let pendingRefresh: Promise<RefreshOutcome> | null = null;

async function performRefresh(): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return { invalid: true };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return { networkError: true };
  }

  let json: ApiResponse<{ accessToken: string }>;
  try {
    json = (await res.json()) as ApiResponse<{ accessToken: string }>;
  } catch {
    return { networkError: true };
  }

  if (!res.ok || !json.success) {
    await clearTokens();
    return { invalid: true };
  }

  await setTokens(json.data.accessToken, refreshToken);
  return { accessToken: json.data.accessToken };
}

function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!pendingRefresh) {
    pendingRefresh = performRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

// Exposed for callers that can't go through apiRequest (e.g. reportService's File.downloadFileAsync,
// which needs the token up front rather than as a per-fetch header apiRequest attaches itself) but
// still need the same "access token may have expired — refresh and retry once" behavior. Returns
// null only when the refresh token itself is invalid or missing, i.e. the session is genuinely over.
export async function getFreshAccessToken(): Promise<string | null> {
  const outcome = await refreshAccessToken();
  return 'accessToken' in outcome ? outcome.accessToken : null;
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
    const outcome = await refreshAccessToken();
    if ('accessToken' in outcome) {
      try {
        res = await performFetch(path, options, outcome.accessToken);
      } catch {
        throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', 0);
      }
    } else if ('networkError' in outcome) {
      throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', 0);
    }
    // 'invalid' falls through to parse/throw the original 401 response below — the refresh
    // token really is gone, so the caller's own auth-failure handling should take over.
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
    // useAuth excludes the login/register calls themselves (they pass auth:false) — a
    // suspension surfaced there is handled locally by LoginScreen's own catch, not this
    // mid-session path.
    if (useAuth && json.code === 'ACCOUNT_SUSPENDED') {
      onAccountSuspended?.(json.error);
    }
    throw new ApiError(json.error, json.code, res.status);
  }
  return json.data;
}
