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
