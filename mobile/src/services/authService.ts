import type { User } from '../types/api';
import { apiRequest, clearTokens, setTokens } from './api';

export type RegisterUserType = 'STUDENT' | 'PARENT' | 'INSTITUTION';

export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  userType: RegisterUserType;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export async function register(input: RegisterInput): Promise<User> {
  return apiRequest<User>('/auth/register', { method: 'POST', body: input, auth: false });
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const result = await apiRequest<LoginResult>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });
  await setTokens(result.accessToken, result.refreshToken);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
  } finally {
    await clearTokens();
  }
}

export async function getMe(): Promise<User> {
  return apiRequest<User>('/auth/me');
}
