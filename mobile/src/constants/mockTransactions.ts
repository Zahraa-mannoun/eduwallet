import type { BudgetCategoryKey } from './budgetCategories';
import { colors } from '../theme/colors';

export type TransactionType = 'SENT' | 'RECEIVED';

export type TransactionStatus =
  | 'PENDING'
  | 'AUTO_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EMERGENCY'
  // Withdrawal-only status with no TransactionStatus equivalent — see types/api.ts's
  // Transaction.status. Included here only so screens that still index this map by a bare
  // transaction.status don't hit a type error; TransactionHistoryScreen/DashboardScreen use
  // utils/transactionDisplay.ts's transactionStatusMeta() instead, which handles it properly.
  | 'PENDING_PARENT_APPROVAL';

export type MockTransaction = {
  id: string;
  type: TransactionType;
  counterparty: string;
  amount: number;
  category: BudgetCategoryKey;
  status: TransactionStatus;
  date: string;
  note?: string;
};

export const TRANSACTION_STATUS_META: Record<TransactionStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#F59E0B' },
  AUTO_APPROVED: { label: 'Auto-Approved', color: colors.accent },
  APPROVED: { label: 'Approved', color: colors.accent },
  REJECTED: { label: 'Rejected', color: colors.danger },
  EMERGENCY: { label: 'Emergency', color: '#F97316' },
  PENDING_PARENT_APPROVAL: { label: 'Pending Approval', color: '#F59E0B' },
};

export const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    id: 'TXN-J1K2L3',
    type: 'SENT',
    counterparty: 'Tech Store',
    amount: 120.0,
    category: 'software',
    status: 'PENDING',
    date: '2026-07-12T14:45:00',
    note: 'Laptop software license',
  },
  {
    id: 'TXN-A1B2C3',
    type: 'SENT',
    counterparty: 'Campus Café',
    amount: 8.5,
    category: 'food',
    status: 'AUTO_APPROVED',
    date: '2026-07-10T12:30:00',
    note: 'Lunch',
  },
  {
    id: 'TXN-D4E5F6',
    type: 'SENT',
    counterparty: 'EduStore',
    amount: 45.0,
    category: 'books',
    status: 'APPROVED',
    date: '2026-07-09T09:15:00',
    note: 'Textbooks',
  },
  {
    id: 'TXN-G7H8I9',
    type: 'RECEIVED',
    counterparty: 'Mom & Dad',
    amount: 200.0,
    category: 'tuition',
    status: 'AUTO_APPROVED',
    date: '2026-07-08T18:00:00',
    note: 'Monthly allowance',
  },
  {
    id: 'TXN-M4N5O6',
    type: 'SENT',
    counterparty: 'Grocery Store',
    amount: 32.75,
    category: 'food',
    status: 'AUTO_APPROVED',
    date: '2026-07-06T20:10:00',
  },
  {
    id: 'TXN-P7Q8R9',
    type: 'SENT',
    counterparty: 'Bus Pass Office',
    amount: 15.0,
    category: 'transport',
    status: 'REJECTED',
    date: '2026-07-05T08:00:00',
    note: 'Monthly pass',
  },
];
