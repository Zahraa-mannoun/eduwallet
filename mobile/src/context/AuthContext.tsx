import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type UserType = 'STUDENT' | 'PARENT' | 'INSTITUTION';

type AuthContextValue = {
  userType: UserType | null;
  userName: string;
  login: (userType: UserType, userName: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [userType, setUserType] = useState<UserType | null>(null);
  const [userName, setUserName] = useState('');

  const login = (nextUserType: UserType, nextUserName: string) => {
    setUserType(nextUserType);
    setUserName(nextUserName);
  };

  const logout = () => {
    setUserType(null);
    setUserName('');
  };

  const value = useMemo(
    () => ({ userType, userName, login, logout }),
    [userType, userName]
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
