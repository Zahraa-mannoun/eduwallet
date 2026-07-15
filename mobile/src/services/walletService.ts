import type { Currency, Transaction, TransactionCategory, UserType, Wallet } from '../types/api';
import { apiRequest } from './api';

export async function getWallet(): Promise<Wallet> {
  return apiRequest<Wallet>('/wallet');
}

export async function topUp(
  amount: number,
  currency: Currency
): Promise<{ wallet: Wallet; transaction: Transaction }> {
  return apiRequest('/wallet/topup', { method: 'POST', body: { amount, currency } });
}

export type TransferInput = {
  toWalletId: string;
  amount: number;
  currency: Currency;
  category: TransactionCategory;
  note?: string;
};

export async function transfer(
  input: TransferInput
): Promise<{ transaction: Transaction; requiresApproval: boolean }> {
  return apiRequest('/wallet/transfer', { method: 'POST', body: input });
}

export type GetTransactionsParams = {
  page?: number;
  limit?: number;
  category?: TransactionCategory;
  status?: string;
};

export async function getTransactions(
  params: GetTransactionsParams = {}
): Promise<{ transactions: Transaction[]; total: number; page: number; limit: number }> {
  return apiRequest('/wallet/transactions', { query: params });
}

export async function lookupWalletByEmail(
  email: string,
  currency?: Currency
): Promise<{ walletId: string; fullName: string; currency: Currency; userType: UserType }> {
  return apiRequest('/wallet/lookup', { query: { email, currency } });
}
