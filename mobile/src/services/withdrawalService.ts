import type { WithdrawalRequest, WithdrawalRequestWithStudent } from '../types/api';
import { apiRequest } from './api';

// Completed withdrawals only — dispensed in person by an agent, not requested by the
// student. See ApprovalsListScreen / getPendingApprovals below for the one exception
// (GENERAL over the parent's approval threshold) that still needs a parent decision.
export async function getMyWithdrawals(): Promise<WithdrawalRequest[]> {
  return apiRequest<WithdrawalRequest[]>('/withdrawals/mine');
}

export async function getPendingApprovals(): Promise<WithdrawalRequestWithStudent[]> {
  return apiRequest<WithdrawalRequestWithStudent[]>('/withdrawals/pending-approval');
}

export async function approveWithdrawal(id: string): Promise<WithdrawalRequest> {
  return apiRequest<WithdrawalRequest>(`/withdrawals/${id}/approve`, { method: 'PATCH' });
}

export async function rejectWithdrawal(id: string, reason: string): Promise<WithdrawalRequest> {
  return apiRequest<WithdrawalRequest>(`/withdrawals/${id}/reject`, {
    method: 'PATCH',
    body: { reason },
  });
}

export type UploadReceiptInput = {
  withdrawalId: string;
  fileUri: string;
  fileName: string;
  fileType: string;
  merchantName?: string;
  // Present on web only (expo-document-picker returns a real File object there) — see
  // blockchainService.ts's uploadDocument for why this needs special handling.
  file?: File;
};

export async function uploadReceipt(input: UploadReceiptInput): Promise<WithdrawalRequest> {
  const formData = new FormData();
  if (input.file) {
    formData.append('file', input.file, input.fileName);
  } else {
    formData.append(
      'file',
      { uri: input.fileUri, name: input.fileName, type: input.fileType } as unknown as Blob
    );
  }
  if (input.merchantName) {
    formData.append('merchantName', input.merchantName);
  }

  return apiRequest<WithdrawalRequest>(`/withdrawals/${input.withdrawalId}/upload-receipt`, {
    method: 'POST',
    formData,
  });
}
