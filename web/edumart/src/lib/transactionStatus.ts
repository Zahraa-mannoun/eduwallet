// Canonical TransactionStatus labels for this app. A card payment here is always cleared by the
// system with no parent involved, so in practice this only ever sees AUTO_APPROVED — the other
// values are covered defensively so the badge never falls back to a raw enum string.
const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Processing',
  AUTO_APPROVED: 'Auto-Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EMERGENCY: 'Emergency',
};

export function transactionStatusLabel(status: string): string {
  return TRANSACTION_STATUS_LABELS[status] ?? status;
}
