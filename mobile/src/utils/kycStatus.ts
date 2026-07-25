import type { KYCStatus } from '../types/api';

// The backend only tracks PENDING/VERIFIED/REJECTED — a student who hasn't uploaded
// anything yet is still PENDING in the database. UI needs a fourth state, so it's
// derived the same way the admin web dashboard does (see kycDisplayStatus.ts):
// PENDING with zero documents on file means verification was never started.
export type EffectiveKYCStatus = KYCStatus | 'UNVERIFIED';

export function getEffectiveKYCStatus(kycStatus: KYCStatus, hasDocuments: boolean): EffectiveKYCStatus {
  if (kycStatus === 'PENDING' && !hasDocuments) {
    return 'UNVERIFIED';
  }
  return kycStatus;
}
