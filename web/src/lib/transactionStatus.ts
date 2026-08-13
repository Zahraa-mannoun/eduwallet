import type { TransactionRow, WithdrawalStatus } from '../types/admin';
import type { BadgeTone } from '../components/Badge';

// A withdrawal-derived row still awaiting parent approval or agent dispense is synthesized by
// admin.service.ts from WithdrawalRequest, not a real Transaction row — it never got a `note`.
// Once an agent actually dispenses the cash, disburse() creates a real Transaction row and
// stamps note: 'Cash withdrawal'. Distinguishing these matters because both can carry
// status: 'APPROVED' but mean very different things (still waiting vs already in hand).
function isCompletedWithdrawal(tx: TransactionRow): boolean {
  return tx.receiverName === 'Cash Withdrawal' && tx.note === 'Cash withdrawal';
}

// The single source of truth for a transaction/withdrawal row's status badge — label and tone
// both follow from *why* a status was reached, not the raw status string alone:
// - "Auto-Approved" only ever means the system cleared it with no parent involved (under
//   threshold P2P, any card payment, any admin top-up, or an immediate agent cash dispense).
// - "Approved" only ever means a parent manually approved it.
// - A completed cash withdrawal reads "Completed", never "Auto-Approved"/"Approved", even
//   though its underlying TransactionStatus is one of those two (see disburse() in
//   withdrawals.service.ts) — the approval path stopped mattering once cash is in hand.
export function transactionStatusMeta(tx: TransactionRow): { label: string; tone: BadgeTone } {
  const isCardPayment = tx.fromWalletId !== null && tx.toWalletId === null && tx.receiverName !== 'Cash Withdrawal';
  const isAdminTopUp = tx.fromWalletId === null;
  if (isCardPayment || isAdminTopUp) {
    return { label: 'Auto-Approved', tone: 'green' };
  }

  if (tx.receiverName === 'Cash Withdrawal') {
    if (tx.status === 'PENDING_PARENT_APPROVAL') {
      return { label: 'Awaiting Parent Approval', tone: 'yellow' };
    }
    if (tx.status === 'REJECTED') {
      return { label: 'Rejected', tone: 'red' };
    }
    if (isCompletedWithdrawal(tx)) {
      return { label: 'Completed', tone: 'green' };
    }
    // status === 'APPROVED' but not yet dispensed by an agent.
    return { label: 'Approved', tone: 'blue' };
  }

  // P2P transfer. PENDING only ever fires when a transfer is over the parent's threshold and
  // waiting on them — same meaning and treatment as PENDING_PARENT_APPROVAL above, not a
  // generic "system processing" state.
  switch (tx.status) {
    case 'AUTO_APPROVED':
      return { label: 'Auto-Approved', tone: 'green' };
    case 'PENDING':
      return { label: 'Awaiting Parent Approval', tone: 'yellow' };
    case 'APPROVED':
      return { label: 'Approved', tone: 'blue' };
    case 'REJECTED':
      return { label: 'Rejected', tone: 'red' };
    case 'EMERGENCY':
      return { label: 'Emergency', tone: 'orange' };
    default:
      return { label: 'Awaiting Parent Approval', tone: 'yellow' };
  }
}

// Bare status-string labels — for filter dropdowns and other places with just the enum value
// and no full transaction/withdrawal row to derive context from. transactionStatusMeta() above
// is the richer, context-aware version and should be preferred wherever a full row is available.
export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  AUTO_APPROVED: 'Auto-Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EMERGENCY: 'Emergency',
  PENDING_PARENT_APPROVAL: 'Awaiting Parent Approval',
  COMPLETED: 'Completed',
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING: 'Processing',
  PENDING_PARENT_APPROVAL: 'Awaiting Parent Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
};
