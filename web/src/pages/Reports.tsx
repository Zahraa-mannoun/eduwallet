import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { formatDate } from '../lib/format';
import { reportStatusTone } from '../lib/badgeTones';
import { REPORT_PERIOD_LABELS } from '../types/admin';
import type { ReportRequestRow, ReportStatus } from '../types/admin';

const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: 'Requested',
  GENERATED: 'Generated (Not Sent)',
  SENT: 'Sent',
};

const INCLUDE_LABELS: Array<{ key: keyof ReportRequestRow; label: string }> = [
  { key: 'includeCardPurchases', label: 'Card Purchases' },
  { key: 'includeTransfers', label: 'Transfers' },
  { key: 'includeWithdrawals', label: 'Withdrawals' },
  { key: 'includeFlagged', label: 'Flagged' },
  { key: 'includePending', label: 'Pending' },
  { key: 'includeSavings', label: 'Savings' },
];

export function Reports() {
  const [reports, setReports] = useState<ReportRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [previewReport, setPreviewReport] = useState<ReportRequestRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<ReportRequestRow[]>>('/reports');
      setReports(unwrap(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(load);
  useSocketRefetch(load);

  // Revokes the previous blob URL whenever the preview changes or the page unmounts — same
  // leak concern as AgentWithdrawals.tsx's receipt preview.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleGenerate = async (report: ReportRequestRow) => {
    setBusyId(report.id);
    setError(null);
    try {
      await api.post(`/reports/${report.id}/generate`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = async (report: ReportRequestRow) => {
    setPreviewReport(report);
    setPreviewUrl(null);
    setPreviewError(null);
    setIsPreviewLoading(true);
    try {
      const response = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(response.data as Blob));
    } catch (err) {
      setPreviewError(getErrorMessage(err));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (isSending) return;
    setPreviewReport(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  const handleSendToParent = async () => {
    if (!previewReport) return;
    setIsSending(true);
    setPreviewError(null);
    try {
      await api.post(`/reports/${previewReport.id}/send`);
      setPreviewReport(null);
      setPreviewUrl(null);
      await load();
    } catch (err) {
      setPreviewError(getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">History Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Parent-requested transaction history reports, generated as downloadable PDFs.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Parent</th>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Requested</th>
              <th className="px-4 py-3 text-left">Included</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && reports.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No report requests yet
                </td>
              </tr>
            )}
            {!isLoading &&
              reports.map((report) => (
                <tr key={report.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{report.parent.fullName}</div>
                    <div className="text-xs text-slate-500">{report.parent.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{report.student.fullName}</div>
                    <div className="text-xs text-slate-500">{report.student.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{REPORT_PERIOD_LABELS[report.period]}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(report.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {INCLUDE_LABELS.filter((item) => report[item.key]).map((item) => (
                        <span
                          key={item.key}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={reportStatusTone[report.status] ?? 'gray'}>
                      {REPORT_STATUS_LABEL[report.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {report.status === 'PENDING' && (
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => void handleGenerate(report)}
                        className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-40"
                      >
                        {busyId === report.id ? 'Generating…' : 'Generate PDF'}
                      </button>
                    )}
                    {report.status === 'GENERATED' && (
                      <button
                        type="button"
                        onClick={() => void openPreview(report)}
                        className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-600"
                      >
                        Preview
                      </button>
                    )}
                    {report.status === 'SENT' && (
                      <button
                        type="button"
                        onClick={() => void openPreview(report)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        View PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Report Preview — {previewReport.student.fullName}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  For {previewReport.parent.fullName} · {REPORT_PERIOD_LABELS[previewReport.period]}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                disabled={isSending}
                aria-label="Close"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {previewError && (
              <p className="mx-5 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {previewError}
              </p>
            )}

            <div className="min-h-0 flex-1 bg-slate-50 p-4">
              <div className="h-full w-full overflow-hidden rounded-md border border-slate-200 bg-white">
                {isPreviewLoading && (
                  <p className="flex h-full items-center justify-center text-sm text-slate-400">
                    Loading preview…
                  </p>
                )}
                {!isPreviewLoading && previewUrl && (
                  <iframe src={previewUrl} title="Report preview" className="h-full w-full" />
                )}
                {!isPreviewLoading && !previewUrl && !previewError && (
                  <p className="flex h-full items-center justify-center text-sm text-slate-400">
                    Could not load the report preview.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closePreview}
                disabled={isSending}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              {previewReport.status === 'GENERATED' && (
                <button
                  type="button"
                  onClick={() => void handleSendToParent()}
                  disabled={isSending || !previewUrl}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40"
                >
                  {isSending ? 'Sending…' : 'Send to Parent'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
