import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import type { ApiResponse, User } from '../types';
import { api, getApiError, getErrorMessage, tokenStorage, unwrap } from '../lib/api';

type LoginResult = { user: User; accessToken: string; refreshToken: string };

type AuthContextValue = {
  agent: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function formatSuspensionMessage(reason: string): string {
  return `Your account has been suspended: ${reason}. Please contact your administrator.`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [agent, setAgent] = useState<User | null>(() => tokenStorage.getStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    let result: LoginResult;
    try {
      const response = await api.post<ApiResponse<LoginResult>>('/auth/login', { email, password });
      result = unwrap(response.data);
    } catch (error) {
      const { message, code } = getApiError(error);
      if (code === 'ACCOUNT_SUSPENDED') {
        throw new Error(formatSuspensionMessage(message));
      }
      throw new Error(message || getErrorMessage(error));
    }

    if (result.user.userType !== 'AGENT') {
      throw new Error('This portal is for agents only');
    }

    tokenStorage.setSession(result.accessToken, result.refreshToken, result.user);
    setAgent(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setAgent(null);
  }, []);

  // Catches a suspension that happens mid-session — the agent is already logged in and
  // suspended.suspended is re-checked on every authenticate() call on the backend, so the
  // very next request (e.g. the notification-bell poll) comes back 403 ACCOUNT_SUSPENDED.
  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          const { message, code } = getApiError(error);
          if (code === 'ACCOUNT_SUSPENDED') {
            tokenStorage.clear();
            setAgent(null);
            navigate('/login', {
              replace: true,
              state: { suspensionMessage: formatSuspensionMessage(message) },
            });
          }
        }
        return Promise.reject(error);
      }
    );
    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, [navigate]);

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
