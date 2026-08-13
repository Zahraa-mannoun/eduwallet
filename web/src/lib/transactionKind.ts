import type { TransactionRow } from '../types/admin';

export type TransactionKind = 'P2P' | 'CARD_PAYMENT' | 'FUNDING' | 'WITHDRAWAL';

// Mirrors the backend's own definitions exactly (see admin.service.ts's getAnalytics()
// spending/funding filters, and transactionStatus.ts's isCompletedWithdrawal convention) —
// there is no `type`/`kind` discriminator anywhere in the schema, so every row is bucketed
// purely from fields already on TransactionRow. Order matters: a completed cash withdrawal and
// a card payment both have toWalletId === null, so the withdrawal marker must be checked first.
export function bucketTransaction(tx: TransactionRow): TransactionKind {
  if (tx.receiverName === 'Cash Withdrawal') {
    return 'WITHDRAWAL';
  }

  if (tx.fromWalletId !== null && tx.toWalletId === null) {
    return 'CARD_PAYMENT';
  }

  const fromType = tx.fromWallet?.user.userType;
  const toType = tx.toWallet?.user.userType;
  const isAdminInjection = tx.fromWalletId === null;
  const isLockedFundingOrScholarship =
    (fromType === 'PARENT' || fromType === 'INSTITUTION') && toType === 'STUDENT';

  if (isAdminInjection || isLockedFundingOrScholarship) {
    return 'FUNDING';
  }

  return 'P2P';
}
