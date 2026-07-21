import type { KYCStatus } from '@eduwallet/shared';
import type { BadgeTone } from '../components/Badge';

export function getKycDisplayStatus(
  kycStatus: KYCStatus,
  hasDocuments: boolean | undefined
): { tone: BadgeTone; label: string } {
  if (kycStatus === 'VERIFIED') {
    return { tone: 'green', label: 'Verified' };
  }
  if (kycStatus === 'REJECTED') {
    return { tone: 'red', label: 'Rejected' };
  }
  if (hasDocuments) {
    return { tone: 'yellow', label: 'Awaiting Review' };
  }
  return { tone: 'gray', label: 'Not Submitted' };
}
