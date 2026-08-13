import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Transaction, WithdrawalStatus } from '../types/api';
import { BUDGET_CATEGORIES } from '../constants/budgetCategories';
import type { BudgetCategoryKey } from '../constants/budgetCategories';

const categoryLookup = new Map(BUDGET_CATEGORIES.map((category) => [category.key, category]));

// Dark-on-light pairs (not a single hue split by alpha) so a status badge always reads as a
// distinct pill next to the amount, even when both happen to be "green" — a received amount and
// an Auto-Approved badge both derived from the same base green used to visually merge together.
export const RECEIVED_AMOUNT_COLOR = '#065F46';
export const SENT_AMOUNT_COLOR = '#991B1B';

// What kind of money movement a transaction represents, used to pick its left-side icon circle.
// Cash withdrawals are tracked in the separate WithdrawalRequest model, not as their own row in
// the Transaction table — GET /wallet/transactions merges both in, real Transaction rows for a
// completed dispense and synthetic rows for one still awaiting parent/agent action, always
// tagged receiverName: 'Cash Withdrawal' either way (see wallet.service.ts), which is what
// classifyTransaction below actually keys off.
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
  if (transaction.receiverName === 'Cash Withdrawal') return 'WITHDRAWAL';
  // Per the backend schema: receiverName is set for BOTH card/merchant payments and named P2P
  // transfers, but only a P2P transfer has a real toWalletId (a merchant isn't a EduWallet
  // user) — that's the reliable signal, not receiverName's presence.
  if (!transaction.toWalletId) return 'CARD_PAYMENT';
  return 'SENT';
}

// A withdrawal-derived row still awaiting parent approval or agent dispense is synthesized by
// wallet.service.ts from WithdrawalRequest, not a real Transaction row — it never got a `note`.
// Once an agent actually dispenses the cash, disburse() creates a real Transaction row and
// stamps note: 'Cash withdrawal'. Distinguishing these matters because both can carry
// status: 'APPROVED' but mean very different things (still waiting vs already in hand).
export function isCompletedWithdrawal(transaction: Transaction): boolean {
  return transaction.receiverName === 'Cash Withdrawal' && transaction.note === 'Cash withdrawal';
}

export type StatusBadgeMeta = { emoji: string; label: string; bg: string; fg: string };

const GREEN: Omit<StatusBadgeMeta, 'emoji' | 'label'> = { bg: '#D1FAE5', fg: '#065F46' };
const AMBER: Omit<StatusBadgeMeta, 'emoji' | 'label'> = { bg: '#FEF3C7', fg: '#92400E' };
const BLUE: Omit<StatusBadgeMeta, 'emoji' | 'label'> = { bg: '#DBEAFE', fg: '#1E40AF' };
const RED: Omit<StatusBadgeMeta, 'emoji' | 'label'> = { bg: '#FEE2E2', fg: '#991B1B' };
const ORANGE: Omit<StatusBadgeMeta, 'emoji' | 'label'> = { bg: '#FFEDD5', fg: '#9A3412' };
const GRAY: Omit<StatusBadgeMeta, 'emoji' | 'label'> = { bg: '#F3F4F6', fg: '#6B7280' };

// The single source of truth for a transaction/withdrawal row's status badge — label, emoji,
// and color all follow from *why* a status was reached, not the raw status string alone:
// - "Auto-Approved" only ever means the system cleared it with no parent involved (under
//   threshold P2P, any card payment, any admin top-up, or an immediate agent cash dispense).
// - "Approved" only ever means a parent manually approved it.
// - A completed cash withdrawal reads "Completed", never "Auto-Approved"/"Approved", even
//   though its underlying TransactionStatus is one of those two (see disburse() in
//   withdrawals.service.ts) — the approval path stopped mattering once cash is in hand.
export function transactionStatusMeta(transaction: Transaction, type: TxDisplayType): StatusBadgeMeta {
  if (type === 'CARD_PAYMENT' || type === 'ADMIN_TOPUP') {
    return { emoji: '✅', label: 'Auto-Approved', ...GREEN };
  }

  if (type === 'WITHDRAWAL') {
    if (transaction.status === 'PENDING_PARENT_APPROVAL') {
      return { emoji: '⏳', label: 'Awaiting Parent Approval', ...AMBER };
    }
    if (transaction.status === 'REJECTED') {
      return { emoji: '❌', label: 'Rejected', ...RED };
    }
    if (isCompletedWithdrawal(transaction)) {
      return { emoji: '✅', label: 'Completed', ...GREEN };
    }
    // status === 'APPROVED' but not yet dispensed by an agent.
    return { emoji: '🔵', label: 'Approved', ...BLUE };
  }

  // P2P transfer (SENT/RECEIVED). PENDING only ever fires when a transfer is over the parent's
  // threshold and waiting on them — same meaning and treatment as the withdrawal branch's
  // PENDING_PARENT_APPROVAL above, not a generic "system processing" state.
  switch (transaction.status) {
    case 'AUTO_APPROVED':
      return { emoji: '✅', label: 'Auto-Approved', ...GREEN };
    case 'PENDING':
      return { emoji: '⏳', label: 'Awaiting Parent Approval', ...AMBER };
    case 'APPROVED':
      return { emoji: '🔵', label: 'Approved', ...BLUE };
    case 'REJECTED':
      return { emoji: '❌', label: 'Rejected', ...RED };
    case 'EMERGENCY':
      return { emoji: '🚨', label: 'Emergency', ...ORANGE };
    default:
      return { emoji: '⏳', label: 'Awaiting Parent Approval', ...AMBER };
  }
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

// Badge for a raw WithdrawalRequest's own status — distinct from transactionStatusMeta() above,
// which only ever sees a withdrawal once it's been merged into the transaction-history feed
// (real or synthetic Transaction shape). Screens working directly with WithdrawalRequest rows
// (WithdrawalScreen, ParentStudentDetailScreen) use this instead.
export function withdrawalStatusMeta(status: WithdrawalStatus): StatusBadgeMeta {
  switch (status) {
    case 'PENDING_PARENT_APPROVAL':
      return { emoji: '⏳', label: 'Awaiting Parent Approval', ...AMBER };
    case 'APPROVED':
      return { emoji: '🔵', label: 'Approved', ...BLUE };
    case 'REJECTED':
      return { emoji: '❌', label: 'Rejected', ...RED };
    case 'COMPLETED':
      return { emoji: '✅', label: 'Completed', ...GREEN };
    default:
      return { emoji: '⏳', label: 'Processing', ...GRAY };
  }
}
