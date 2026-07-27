import type { AcademicDocument, KYCStatus } from '../types/api';
import { apiRequest } from './api';

export type SubmitKYCInput = {
  documentType: 'STUDENT_ID' | 'ENROLLMENT_CERTIFICATE';
  fileUri: string;
  fileName: string;
  fileType: string;
  // On web, expo-document-picker returns a blob: URI plus the real browser File
  // object — the URI can't be re-read cross-origin, so the File must be used directly.
  file?: File;
};

export async function submitDocument(input: SubmitKYCInput): Promise<AcademicDocument> {
  const formData = new FormData();
  if (input.file) {
    formData.append('file', input.file, input.fileName);
  } else {
    formData.append(
      'file',
      // React Native's FormData accepts this { uri, name, type } file descriptor shape,
      // which isn't a real Blob at runtime — the cast reflects that RN-specific contract.
      { uri: input.fileUri, name: input.fileName, type: input.fileType } as unknown as Blob
    );
  }
  formData.append('documentType', input.documentType);
  formData.append('fileName', input.fileName);
  formData.append('fileType', input.fileType);

  return apiRequest<AcademicDocument>('/kyc/submit', { method: 'POST', formData });
}

export async function getKYCStatus(): Promise<{
  kycStatus: KYCStatus;
  documents: AcademicDocument[];
  rejectionReason: string | null;
}> {
  return apiRequest('/kyc/status');
}

export async function getMyDocuments(): Promise<AcademicDocument[]> {
  return apiRequest<AcademicDocument[]>('/kyc/documents');
}
