import { api, unwrap } from './api';
import type { ApiResponse, LoginResponseData } from '../types';

export async function login(email: string, password: string): Promise<LoginResponseData> {
  const response = await api.post<ApiResponse<LoginResponseData>>('/auth/login', {
    email,
    password,
  });
  return unwrap(response.data);
}
