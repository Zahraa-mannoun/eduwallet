import { createContext, useContext, useState, type ReactNode } from 'react';
import { authStorage } from '../services/api';
import * as authService from '../services/auth';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authStorage.getUser<AuthUser>());

  async function login(email: string, password: string) {
    const result = await authService.login(email, password);

    if (result.user.userType !== 'STUDENT') {
      throw new Error('ScanMart is only available to STUDENT accounts. Please sign in with a student EduWallet account.');
    }

    authStorage.setSession(result.accessToken, result.user);
    setUser(result.user);
  }

  function logout() {
    authStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
