import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/api';
import * as authService from '../services/authService';
import type { RegisterUserType } from '../services/authService';
import { ApiError, clearTokens, getAccessToken, setAccountSuspendedHandler } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export type UserType = RegisterUserType;

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // True once the cold-start session check has given up retrying purely because it couldn't
  // reach the server (or got rate-limited) — never because the token was confirmed invalid.
  // AppNavigator shows a "can't connect" screen for this, NOT the Login screen, since the
  // stored session may still be perfectly valid once connectivity is back.
  isOffline: boolean;
  error: string | null;
  // Set when an already-logged-in session gets a 403 ACCOUNT_SUSPENDED on some other API call
  // (an admin suspended the account mid-session) — distinct from the login-time suspension
  // LoginScreen already handles itself via its own catch on login(). LoginScreen reads this to
  // show the same suspension screen immediately once AppNavigator swaps back to it.
  suspensionReason: string | null;
  clearSuspensionReason: () => void;
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
  retryConnection: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function messageFromError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

// A completed-but-inconclusive response (couldn't reach the server, or got rate-limited) must
// be retried rather than treated as proof the session is invalid. NETWORK_ERROR uses status 0
// (see api.ts); 429 is @fastify/rate-limit's "too many requests" — hitting it is a sign of too
// much polling, not an invalid token, and must never be read as one.
function isInconclusiveError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status === 429);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const MAX_ATTEMPTS = 5;

    (async () => {
      setIsLoading(true);
      setIsOffline(false);

      let token: string | null;
      try {
        token = await getAccessToken();
      } catch {
        // SecureStore itself failed to read (e.g. a corrupted keystore) — there's no session
        // to restore either way, but this must not hang the splash screen forever.
        token = null;
      }

      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // A stored token must only be treated as invalid on a genuine auth failure confirmed by
      // the server (a real 401/403 after apiRequest's own /auth/refresh attempt) — a transient
      // network hiccup or a rate-limit response on cold start must never silently boot the user
      // back to the Login screen while their session is still perfectly valid.
      let restored = false;
      let wasInconclusive = false;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const me = await authService.getMe();
          if (!cancelled) {
            setUser(me);
            connectSocket(token);
          }
          restored = true;
          break;
        } catch (err) {
          if (!isInconclusiveError(err)) break; // confirmed invalid — stop, go to Login
          wasInconclusive = true;
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }
      }

      if (cancelled) return;
      if (!restored && wasInconclusive) {
        setIsOffline(true);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [checkAttempt]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await authService.login({ email, password });
      setUser(result.user);
      connectSocket(result.accessToken);
    } catch (err) {
      setError(messageFromError(err));
      throw err;
    }
  }, []);

  const register = useCallback(
    async (input: { fullName: string; email: string; password: string; userType: UserType }) => {
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
    },
    []
  );

  // The session is already dead server-side by the time this fires (the account was just
  // suspended), so there's no point round-tripping through authService.logout()'s own
  // POST /auth/logout — it would just 403 again. Clear the client side directly instead.
  useEffect(() => {
    setAccountSuspendedHandler((reason) => {
      disconnectSocket();
      setUser(null);
      void clearTokens();
      setSuspensionReason(reason);
    });
    return () => setAccountSuspendedHandler(null);
  }, []);

  const clearSuspensionReason = useCallback(() => setSuspensionReason(null), []);

  const logout = useCallback(async () => {
    disconnectSocket();
    setUser(null);
    try {
      await authService.logout();
    } catch {
      // Tokens are cleared locally by authService.logout()'s finally block regardless.
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Stable across renders (useCallback with no deps) — screens call this from useFocusEffect,
  // and an unstable reference here would make that effect re-fire on every user-state change
  // (i.e. every time this very function resolves), snowballing into repeated GET /auth/me
  // calls that could exhaust the rate limit and mask a real update behind a silently-caught
  // failure below.
  const refreshUser = useCallback(async () => {
    try {
      const me = await authService.getMe();
      setUser(me);
    } catch {
      // Best-effort refresh (e.g. after updating a profile setting) — leave stale state on failure.
    }
  }, []);

  const retryConnection = useCallback(() => setCheckAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      isOffline,
      error,
      suspensionReason,
      clearSuspensionReason,
      login,
      register,
      logout,
      clearError,
      refreshUser,
      retryConnection,
    }),
    [
      user,
      isLoading,
      isOffline,
      error,
      suspensionReason,
      clearSuspensionReason,
      login,
      register,
      logout,
      clearError,
      refreshUser,
      retryConnection,
    ]
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
