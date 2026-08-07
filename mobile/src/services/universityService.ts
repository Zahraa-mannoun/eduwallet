import type {
  DisburseSelectedResult,
  DisbursementPreviewEntry,
  FundIndividualResult,
  SelectedStudentSummary,
  TransactionCategory,
  UniversityStudentSummary,
} from '../types/api';
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

export type SelectStudentsInput = {
  studentIds: string[];
  amountPerStudent: number;
};

// Tab 1's "Notify & Proceed" — declares intent and notifies parents; no money moves yet.
export async function selectStudents(input: SelectStudentsInput): Promise<SelectedStudentSummary[]> {
  return apiRequest<SelectedStudentSummary[]>('/university/select-students', {
    method: 'POST',
    body: input,
  });
}

// Tab 2's list of students currently selected and awaiting a bulk send.
export async function getSelectedStudents(): Promise<SelectedStudentSummary[]> {
  return apiRequest<SelectedStudentSummary[]>('/university/selected-students');
}

export async function disburseSelected(category: TransactionCategory): Promise<DisburseSelectedResult> {
  return apiRequest<DisburseSelectedResult>('/university/disburse-selected', {
    method: 'POST',
    body: { category },
  });
}

export type FundIndividualInput = {
  studentUserId: string;
  amount: number;
  category: TransactionCategory;
};

export async function fundIndividual(input: FundIndividualInput): Promise<FundIndividualResult> {
  return apiRequest<FundIndividualResult>('/university/fund-individual', {
    method: 'POST',
    body: input,
  });
}
