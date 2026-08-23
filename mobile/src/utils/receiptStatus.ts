import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReceiptVerificationStatus, StudentReceiptStatus } from '../types/api';

export type ReceiptBadgeMeta = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  bg: string;
  fg: string;
};

// The single source of truth for a receipt's badge — shared by WithdrawalScreen.tsx (student's
// own view, keyed off the raw nullable WithdrawalRequest.receiptVerificationStatus) and
// ParentStudentDetailScreen.tsx (parent's view, keyed off the backend-derived
// StudentReceiptStatus which already folds "nothing uploaded" into NOT_UPLOADED) so the two
// screens can never drift on wording again.
export const RECEIPT_STATUS_META: Record<StudentReceiptStatus, ReceiptBadgeMeta> = {
  AUTO_VERIFIED: { label: 'Auto Verified', icon: 'check-circle', bg: '#D1FAE5', fg: '#065F46' },
  MANUALLY_VERIFIED: { label: 'Manually Verified', icon: 'check-decagram', bg: '#D1FAE5', fg: '#065F46' },
  FLAGGED: { label: 'Flagged', icon: 'alert', bg: '#FEF3C7', fg: '#92400E' },
  PENDING: { label: 'Pending', icon: 'clock-outline', bg: '#F3F4F6', fg: '#6B7280' },
  PROCESSING: { label: 'Processing...', icon: 'loading', bg: '#DBEAFE', fg: '#1E40AF' },
  REJECTED: { label: 'Rejected', icon: 'close-circle', bg: '#FCA5A5', fg: '#7F1D1D' },
  NOT_UPLOADED: { label: 'No Receipt', icon: 'file-outline', bg: '#F3F4F6', fg: '#6B7280' },
};

// A receipt row only becomes "PROCESSING" once uploadReceipt has written a file — before that,
// receiptVerificationStatus is still whatever default the row was created with, so receiptPath
// is what actually distinguishes "nothing uploaded" from "something uploaded, being checked".
export function receiptBadgeFor(
  receiptPath: string | null,
  status: ReceiptVerificationStatus | null
): ReceiptBadgeMeta {
  if (!receiptPath || !status) return RECEIPT_STATUS_META.NOT_UPLOADED;
  return RECEIPT_STATUS_META[status];
}
