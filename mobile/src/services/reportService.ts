import { File, Paths } from 'expo-file-system';
import type { ReportPeriod, ReportRequest } from '../types/api';
import { API_BASE_URL, apiRequest, getAccessToken } from './api';

export type RequestReportInput = {
  studentUserId: string;
  period: ReportPeriod;
  includeCardPurchases: boolean;
  includeTransfers: boolean;
  includeWithdrawals: boolean;
  includeFlagged: boolean;
  includePending: boolean;
  includeSavings: boolean;
};

export async function requestReport(input: RequestReportInput): Promise<ReportRequest> {
  return apiRequest<ReportRequest>('/reports/request', { method: 'POST', body: input });
}

export async function getMyReports(): Promise<ReportRequest[]> {
  return apiRequest<ReportRequest[]>('/reports/mine');
}

// Downloads the report PDF to the app's document directory and returns a local file:// URI
// ready to be passed to Sharing.shareAsync (react-native-paper has no built-in PDF viewer).
export async function downloadReportPdf(reportId: string): Promise<string> {
  const token = await getAccessToken();
  const destination = new File(Paths.document, `eduwallet-report-${reportId}.pdf`);
  const file = await File.downloadFileAsync(
    `${API_BASE_URL}/reports/${reportId}/download`,
    destination,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      idempotent: true,
    }
  );
  return file.uri;
}
