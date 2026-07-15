import type { Currency, Transaction, TransactionCategory, User } from '../types/api';
import { apiRequest } from './api';

export async function getStudents(): Promise<User[]> {
  return apiRequest<User[]>('/scholarship/students');
}

export type BulkDisburseInput = {
  studentIds: string[];
  amountPerStudent: number;
  currency: Currency;
  category: TransactionCategory;
  note?: string;
};

export type BulkDisburseResult = {
  transactions: Transaction[];
  totalDisbursed: number;
};

export async function bulkDisburse(input: BulkDisburseInput): Promise<BulkDisburseResult> {
  return apiRequest<BulkDisburseResult>('/scholarship/disburse', { method: 'POST', body: input });
}
