import type { BudgetCategory, TransactionCategory } from '../types/api';
import { apiRequest } from './api';

export async function setBudget(
  category: TransactionCategory,
  monthlyLimit: number,
  month: string
): Promise<BudgetCategory> {
  return apiRequest<BudgetCategory>('/budget', { method: 'POST', body: { category, monthlyLimit, month } });
}

export async function getBudgets(
  month?: string
): Promise<{ month: string; budgets: BudgetCategory[] }> {
  return apiRequest('/budget', { query: { month } });
}

export async function updateBudget(
  category: TransactionCategory,
  monthlyLimit: number,
  month?: string
): Promise<BudgetCategory> {
  return apiRequest<BudgetCategory>(`/budget/${category}`, {
    method: 'PUT',
    body: { monthlyLimit },
    query: { month },
  });
}

export async function deleteBudget(category: TransactionCategory, month?: string): Promise<void> {
  await apiRequest(`/budget/${category}`, { method: 'DELETE', query: { month } });
}

export type BudgetCategorySummary = {
  category: TransactionCategory;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  overspent: boolean;
};

export type BudgetAlert = {
  category: TransactionCategory;
  severity: 'OVERSPENT' | 'APPROACHING_LIMIT';
  message: string;
};

export type BudgetSummary = {
  month: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  categories: BudgetCategorySummary[];
  alerts: BudgetAlert[];
};

export async function getBudgetSummary(month?: string): Promise<BudgetSummary> {
  return apiRequest<BudgetSummary>('/budget/summary', { query: { month } });
}
