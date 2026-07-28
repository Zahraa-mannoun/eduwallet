import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/api';
import * as authService from '../services/authService';
import type { RegisterUserType } from '../services/authService';
import { ApiError, getAccessToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export type UserType = RegisterUserType;

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    userType: UserType;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function messageFromError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const MAX_ATTEMPTS = 3;

    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // A stored token must only be treated as invalid on a genuine auth failure (401 after
      // apiRequest's own refresh attempt) — a transient network hiccup on cold start (backend
      // still warming up, spotty wifi) is common on mobile and must not silently boot the user
      // back to the Login screen while their session is still perfectly valid.
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const me = await authService.getMe();
          if (!cancelled) {
            setUser(me);
            connectSocket(token);
          }
          break;
        } catch (err) {
          const isNetworkError = err instanceof ApiError && err.code === 'NETWORK_ERROR';
          if (!isNetworkError || attempt === MAX_ATTEMPTS) break;
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }

      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const result = await authService.login({ email, password });
      setUser(result.user);
      connectSocket(result.accessToken);
    } catch (err) {
      setError(messageFromError(err));
      throw err;
    }
  };

  const register = async (input: {
    fullName: string;
    email: string;
    password: string;
    userType: UserType;
  }) => {
    setError(null);
    try {
      await authService.register(input);
      const result = await authService.login({ email: input.email, password: input.password });
      setUser(result.user);
      connectSocket(result.accessToken);
    } catch (err) {
      setError(messageFromError(err));
      throw err;
    }
  };

  const logout = async () => {
    disconnectSocket();
    setUser(null);
    try {
      await authService.logout();
    } catch {
      // Tokens are cleared locally by authService.logout()'s finally block regardless.
    }
  };

  const clearError = () => setError(null);

  const refreshUser = async () => {
    try {
      const me = await authService.getMe();
      setUser(me);
    } catch {
      // Best-effort refresh (e.g. after updating a profile setting) — leave stale state on failure.
    }
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      error,
      login,
      register,
      logout,
      clearError,
      refreshUser,
    }),
    [user, isLoading, error]
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
