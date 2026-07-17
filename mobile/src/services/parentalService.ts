import type { ParentalControl, Transaction, TransactionCategory, User, Wallet } from '../types/api';
import { apiRequest } from './api';

export type LinkedStudent = {
  student: User;
  link: ParentalControl;
  wallets: Wallet[];
};

export async function getLinkedStudents(): Promise<LinkedStudent[]> {
  return apiRequest<LinkedStudent[]>('/parental/students');
}

export type LinkStudentInput = {
  studentEmail: string;
  approvalThreshold: number;
  categories?: TransactionCategory[];
};

export async function linkStudent(input: LinkStudentInput): Promise<ParentalControl> {
  return apiRequest<ParentalControl>('/parental/link', {
    method: 'POST',
    body: { ...input, categories: input.categories ?? [] },
  });
}

export type UpdateSettingsInput = {
  approvalThreshold: number;
  categories: TransactionCategory[];
};

export async function updateSettings(
  studentId: string,
  input: UpdateSettingsInput
): Promise<ParentalControl> {
  return apiRequest<ParentalControl>(`/parental/settings/${studentId}`, {
    method: 'PUT',
    body: input,
  });
}

export async function getPendingApprovals(): Promise<Transaction[]> {
  return apiRequest<Transaction[]>('/parental/approvals');
}

export async function approveTransaction(transactionId: string): Promise<Transaction> {
  return apiRequest<Transaction>('/parental/approve', { method: 'POST', body: { transactionId } });
}

export async function rejectTransaction(
  transactionId: string,
  reason: string
): Promise<Transaction> {
  return apiRequest<Transaction>('/parental/reject', {
    method: 'POST',
    body: { transactionId, reason },
  });
}

export type MyPermissions = {
  allowedCategories: TransactionCategory[];
  approvalThreshold: string;
  parentName: string;
};

export async function getMyPermissions(): Promise<MyPermissions | null> {
  return apiRequest<MyPermissions | null>('/parental/my-permissions');
}
