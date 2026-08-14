import { useCallback, useEffect, useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import type { BadgeTone } from '../components/Badge';
import { DotBadge } from '../components/DotBadge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { formatDate } from '../lib/format';
import { reportStatusTone } from '../lib/badgeTones';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { REPORT_PERIOD_LABELS } from '../types/admin';
import type { ReportRequestRow, ReportStatus } from '../types/admin';

const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: 'Requested',
  GENERATED: 'Generated (Not Sent)',
  SENT: 'Sent',
};

const INCLUDE_META: Array<{ key: keyof ReportRequestRow; label: string; tone: BadgeTone }> = [
  { key: 'includeCardPurchases', label: 'Card Purchases', tone: 'blue' },
  { key: 'includeTransfers', label: 'Transfers', tone: 'purple' },
  { key: 'includeWithdrawals', label: 'Withdrawals', tone: 'orange' },
  { key: 'includeFlagged', label: 'Flagged', tone: 'red' },
  { key: 'includePending', label: 'Pending', tone: 'yellow' },
  { key: 'includeSavings', label: 'Savings', tone: 'green' },
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
      <PageHeader
        title="History Reports"
        subtitle="Parent-requested transaction history reports, generated as downloadable PDFs"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title="Report Requests" subtitle={`${reports.length} shown`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Parent</th>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>Period</th>
              <th className={TABLE_TH_CLASS}>Requested</th>
              <th className={TABLE_TH_CLASS}>Included</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={7} />}
            {!isLoading && reports.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon={<FileText className="h-8 w-8" />} title="No report requests yet" />
                </td>
              </tr>
            )}
            {!isLoading &&
              reports.map((report, index) => (
                <tr key={report.id} className={tableRowClass(index)}>
                  <td className={TABLE_TD_CLASS}>
                    <PersonCell name={report.parent.fullName} email={report.parent.email} />
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    <PersonCell name={report.student.fullName} email={report.student.email} />
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    <Badge tone="blue">{REPORT_PERIOD_LABELS[report.period]}</Badge>
                  </td>
                  <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDate(report.createdAt)}</td>
                  <td className={TABLE_TD_CLASS}>
                    <div className="flex max-w-xs flex-wrap gap-1.5">
                      {INCLUDE_META.filter((item) => report[item.key]).map((item) => (
                        <Badge key={item.key} tone={item.tone}>
                          {item.label}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    <DotBadge tone={reportStatusTone[report.status] ?? 'gray'}>
                      {REPORT_STATUS_LABEL[report.status]}
                    </DotBadge>
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    {report.status === 'PENDING' && (
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => void handleGenerate(report)}
                        className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-primary-600 disabled:opacity-40"
                      >
                        {busyId === report.id ? 'Generating…' : 'Generate PDF'}
                      </button>
                    )}
                    {report.status === 'GENERATED' && (
                      <button
                        type="button"
                        onClick={() => void openPreview(report)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-primary-600"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                    )}
                    {report.status === 'SENT' && (
                      <button
                        type="button"
                        onClick={() => void openPreview(report)}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.03] hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableCard>

      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="animate-modal-in flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
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
              <p className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {previewError}
              </p>
            )}

            <div className="min-h-0 flex-1 bg-slate-50 p-4">
              <div className="h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              {previewReport.status === 'GENERATED' && (
                <button
                  type="button"
                  onClick={() => void handleSendToParent()}
                  disabled={isSending || !previewUrl}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-40"
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
