import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ApiResponse, User } from '../types';
import { api, getErrorMessage, tokenStorage, unwrap } from '../lib/api';

type LoginResult = { user: User; accessToken: string; refreshToken: string };

type AuthContextValue = {
  agent: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<User | null>(() => tokenStorage.getStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    let result: LoginResult;
    try {
      const response = await api.post<ApiResponse<LoginResult>>('/auth/login', { email, password });
      result = unwrap(response.data);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }

    // Agent portal is admin-only for demo purposes — there's no separate "agent" user type,
    // so any admin account can sign in and act as an agent processing cash withdrawals.
    if (result.user.userType !== 'ADMIN') {
      throw new Error('This account does not have agent access.');
    }

    tokenStorage.setSession(result.accessToken, result.refreshToken, result.user);
    setAgent(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setAgent(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ agent, isAuthenticated: agent !== null, login, logout }),
    [agent, login, logout]
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
