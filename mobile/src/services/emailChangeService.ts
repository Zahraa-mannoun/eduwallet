import type { EmailChangeRequest } from '../types/api';
import { apiRequest } from './api';

export type RequestEmailChangeInput = {
  requestedEmail: string;
  reason: string;
  fileUri: string;
  fileName: string;
  fileType: string;
  // Present on web only (expo-document-picker returns a real File object there) — see
  // blockchainService.ts's uploadDocument for why this needs special handling.
  file?: File;
};

export async function requestEmailChange(input: RequestEmailChangeInput): Promise<EmailChangeRequest> {
  const formData = new FormData();
  formData.append('requestedEmail', input.requestedEmail);
  formData.append('reason', input.reason);
  if (input.file) {
    formData.append('file', input.file, input.fileName);
  } else {
    formData.append(
      'file',
      { uri: input.fileUri, name: input.fileName, type: input.fileType } as unknown as Blob
    );
  }

  return apiRequest<EmailChangeRequest>('/email-change/request', { method: 'POST', formData });
}

export async function getMyRequest(): Promise<EmailChangeRequest | null> {
  return apiRequest<EmailChangeRequest | null>('/email-change/mine');
}
