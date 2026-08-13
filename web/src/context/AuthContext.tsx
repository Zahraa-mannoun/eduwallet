import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ApiResponse, User } from '@eduwallet/shared';
import { api, getErrorMessage, tokenStorage, unwrap } from '../lib/api';
import { disconnectSocket } from '../lib/socket';

type LoginResult = { user: User; accessToken: string; refreshToken: string };

type AuthContextValue = {
  admin: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<User | null>(() => tokenStorage.getStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    let result: LoginResult;
    try {
      const response = await api.post<ApiResponse<LoginResult>>('/auth/login', { email, password });
      result = unwrap(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }

    if (result.user.userType !== 'ADMIN') {
      throw new Error('This account does not have admin access.');
    }

    tokenStorage.setSession(result.accessToken, result.refreshToken, result.user);
    setAdmin(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    disconnectSocket();
    setAdmin(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ admin, isAuthenticated: admin !== null, login, logout }),
    [admin, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
