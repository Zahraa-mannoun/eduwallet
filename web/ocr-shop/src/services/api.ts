import axios from 'axios';
import type { ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'ocrshop_token';
const USER_KEY = 'ocrshop_user';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: <T>(): T | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setSession: (token: string, user: unknown) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function unwrap<T>(data: ApiResponse<T>): T {
  if (!data.success) {
    throw new ApiRequestError(data.error, data.code);
  }
  return data.data;
}

export class ApiRequestError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export function getErrorMessage(error: unknown): string {
  const message = resolveErrorMessage(error);
  // A response can be non-JSON, or a well-formed-but-empty { success:false, error:'' } — either
  // way, a blank string here previously meant the failure UI silently never rendered at all.
  return message.trim().length > 0 ? message : FALLBACK_ERROR_MESSAGE;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (data && !data.success) {
      return data.error;
    }
    if (error.code === 'ECONNABORTED') {
      return "The request timed out. If this was a payment, check your transaction history before retrying — it may have gone through.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return FALLBACK_ERROR_MESSAGE;
}

export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiRequestError) {
    return error.code;
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (data && !data.success) {
      return data.code;
    }
  }
  return undefined;
}
