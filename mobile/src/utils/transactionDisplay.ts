import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Transaction, TransactionStatus } from '../types/api';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

// Dark-on-light pairs (not a single hue split by alpha) so a status badge always reads as a
// distinct pill next to the amount, even when both happen to be "green" — a received amount and
// an Auto-Approved badge both derived from the same base green used to visually merge together.
export const RECEIVED_AMOUNT_COLOR = '#065F46';
export const SENT_AMOUNT_COLOR = '#991B1B';

export const STATUS_BADGE_COLORS: Record<TransactionStatus, { bg: string; fg: string }> = {
  AUTO_APPROVED: { bg: '#D1FAE5', fg: '#065F46' },
  APPROVED: { bg: '#D1FAE5', fg: '#065F46' },
  PENDING: { bg: '#FEF3C7', fg: '#92400E' },
  REJECTED: { bg: '#FEE2E2', fg: '#991B1B' },
  EMERGENCY: { bg: '#FFEDD5', fg: '#9A3412' },
};

// What kind of money movement a transaction represents, used to pick its left-side icon
// circle. Cash withdrawals are tracked entirely through the separate WithdrawalRequest model,
// never as a wallet Transaction row, so WITHDRAWAL is defined for completeness but the wallet
// transactions endpoint every screen here reads from can never actually produce one.
export type TxDisplayType = 'ADMIN_TOPUP' | 'SENT' | 'RECEIVED' | 'CARD_PAYMENT' | 'WITHDRAWAL';

export const TX_TYPE_META: Record<
  TxDisplayType,
  { color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  ADMIN_TOPUP: { color: '#2E5FAC', icon: 'wallet-outline' },
  SENT: { color: '#DC2626', icon: 'arrow-up' },
  RECEIVED: { color: '#10B981', icon: 'arrow-down' },
  CARD_PAYMENT: { color: '#8B5CF6', icon: 'credit-card-outline' },
  WITHDRAWAL: { color: '#F97316', icon: 'cash-multiple' },
};

export function classifyTransaction(transaction: Transaction, isReceived: boolean): TxDisplayType {
  if (!transaction.fromWalletId) return 'ADMIN_TOPUP';
  if (isReceived) return 'RECEIVED';
  // Per the backend schema: receiverName is set for BOTH card/merchant payments and named P2P
  // transfers, but only a P2P transfer has a real toWalletId (a merchant isn't a EduWallet
  // user) — that's the reliable signal, not receiverName's presence.
  if (!transaction.toWalletId) return 'CARD_PAYMENT';
  return 'SENT';
}

export function transactionDisplayTitle(transaction: Transaction, type: TxDisplayType): string {
  if (transaction.note) return transaction.note;
  switch (type) {
    case 'ADMIN_TOPUP':
      return 'Admin Added Funds';
    case 'SENT':
      return transaction.receiverName ? `Sent to ${transaction.receiverName}` : 'Sent';
    case 'RECEIVED':
      return transaction.senderName ? `Received from ${transaction.senderName}` : 'Received';
    case 'CARD_PAYMENT': {
      if (transaction.receiverName) return transaction.receiverName;
      const category = categoryLookup.get(transaction.category.toLowerCase() as BudgetCategoryKey);
      return category?.label ?? 'Card Payment';
    }
    case 'WITHDRAWAL':
      return 'Cash Withdrawal';
  }
}
