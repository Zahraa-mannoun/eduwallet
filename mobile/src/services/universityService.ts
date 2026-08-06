import type { DisbursementPreviewEntry, UniversityStudentSummary } from '../types/api';
import { apiRequest } from './api';

export async function getVerifiedStudents(): Promise<UniversityStudentSummary[]> {
  return apiRequest<UniversityStudentSummary[]>('/university/students');
}

export type PrepareDisbursementInput = {
  studentIds: string[];
  amountPerStudent: number;
};

export async function prepareDisbursement(
  input: PrepareDisbursementInput
): Promise<DisbursementPreviewEntry[]> {
  return apiRequest<DisbursementPreviewEntry[]>('/university/prepare-disbursement', {
    method: 'POST',
    body: input,
  });
}
