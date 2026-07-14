import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Transaction, Wallet } from '../types/api';
import * as walletService from '../services/walletService';
import { ApiError } from '../services/api';
import { useAuth } from './AuthContext';

type WalletContextValue = {
  wallet: Wallet | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { isAuthenticated } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [walletResult, transactionsResult] = await Promise.all([
        walletService.getWallet(),
        walletService.getTransactions({ limit: 10 }),
      ]);
      setWallet(walletResult);
      setTransactions(transactionsResult.transactions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your wallet.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setWallet(null);
      setTransactions([]);
      setError(null);
    }
  }, [isAuthenticated, refresh]);

  const value = useMemo(
    () => ({ wallet, transactions, isLoading, error, refresh }),
    [wallet, transactions, isLoading, error, refresh]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
