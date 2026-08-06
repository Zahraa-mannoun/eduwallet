import type { PersonalSavingsHistory } from '../types/api';
import { apiRequest } from './api';

export type MySavings = {
  balance: string;
  history: PersonalSavingsHistory[];
};

export async function getMySavings(): Promise<MySavings> {
  return apiRequest<MySavings>('/savings');
}

export async function requestWithdrawal(
  amount: number,
  reason: string
): Promise<PersonalSavingsHistory> {
  return apiRequest<PersonalSavingsHistory>('/savings/request-withdrawal', {
    method: 'POST',
    body: { amount, reason },
  });
}

export async function getWithdrawalRequests(): Promise<PersonalSavingsHistory[]> {
  return apiRequest<PersonalSavingsHistory[]>('/savings/withdrawal-requests');
}

export async function approveWithdrawal(id: string): Promise<PersonalSavingsHistory> {
  return apiRequest<PersonalSavingsHistory>(`/savings/withdrawal-requests/${id}/approve`, {
    method: 'PATCH',
  });
}

export async function rejectWithdrawal(id: string, reason: string): Promise<PersonalSavingsHistory> {
  return apiRequest<PersonalSavingsHistory>(`/savings/withdrawal-requests/${id}/reject`, {
    method: 'PATCH',
    body: { reason },
  });
}
