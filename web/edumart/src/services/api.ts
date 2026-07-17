import axios from 'axios';
import type { ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'edumart_token';
const USER_KEY = 'edumart_user';

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

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (data && !data.success) {
      return data.error;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
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
