import type { AcademicDocument, KYCStatus } from '../types/api';
import { apiRequest } from './api';

export type SubmitKYCInput = {
  documentType: 'STUDENT_ID' | 'ENROLLMENT_CERTIFICATE';
  fileName: string;
  fileSize: number;
};

export async function submitDocument(input: SubmitKYCInput): Promise<AcademicDocument> {
  return apiRequest<AcademicDocument>('/kyc/submit', { method: 'POST', body: input });
}

export async function getKYCStatus(): Promise<{ kycStatus: KYCStatus; documents: AcademicDocument[] }> {
  return apiRequest('/kyc/status');
}

export async function getMyDocuments(): Promise<AcademicDocument[]> {
  return apiRequest<AcademicDocument[]>('/kyc/documents');
}
