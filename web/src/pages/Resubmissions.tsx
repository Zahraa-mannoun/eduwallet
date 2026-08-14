import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import type { ApiResponse, KYCStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDate, formatRelativeTime } from '../lib/format';
import type { BadgeTone } from '../components/Badge';
import type { ResubmissionRow } from '../types/admin';

function latestDate(dates: string[]): string | null {
  return dates.length > 0 ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null;
}

const OUTCOME_META: Record<KYCStatus, { label: string; tone: BadgeTone }> = {
  VERIFIED: { label: 'Verified', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  PENDING: { label: 'Pending', tone: 'yellow' },
};

function documentLabel(type: string): string {
  return type === 'STUDENT_ID' ? 'Student ID' : 'Enrollment Cert.';
}

export function Resubmissions() {
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get('highlight');
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  const [rows, setRows] = useState<ResubmissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<ResubmissionRow[]>>('/kyc/resubmissions');
      setRows(unwrap(response.data));
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

  useEffect(() => {
    if (highlightUserId && rows.length > 0) {
      highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightUserId, rows]);

  const viewDocument = async (documentId: string) => {
    try {
      const response = await api.get(`/kyc/document/${documentId}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resubmissions"
        subtitle="Permanent history of every student who was rejected and later resubmitted documents"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title="Resubmissions" subtitle={`${rows.length} shown`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>Previous Rejection Reason</th>
              <th className={TABLE_TH_CLASS}>Old Documents</th>
              <th className={TABLE_TH_CLASS}>New Documents</th>
              <th className={TABLE_TH_CLASS}>Resubmitted</th>
              <th className={TABLE_TH_CLASS}>Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={6} />}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon={<RefreshCw className="h-8 w-8" />} title="No resubmissions yet" />
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row, index) => {
                const resubmittedAt = latestDate(row.newDocuments.map((doc) => doc.createdAt));
                const isHighlighted = row.id === highlightUserId;
                const outcome = OUTCOME_META[row.kycStatus];
                return (
                  <tr
                    key={row.id}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    className={
                      isHighlighted
                        ? 'bg-amber-50 ring-1 ring-inset ring-amber-300'
                        : tableRowClass(index)
                    }
                  >
                    <td className={TABLE_TD_CLASS}>
                      <PersonCell name={row.fullName} email={row.email} />
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      {row.kycRejectionReason ? (
                        <span className="inline-flex max-w-xs items-start gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{row.kycRejectionReason}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      {row.oldDocuments.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {row.oldDocuments.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => void viewDocument(doc.id)}
                              className="inline-flex items-center gap-1.5 self-start rounded-full border-2 border-slate-200 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {documentLabel(doc.documentType ?? '')}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">None on file</span>
                      )}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <div className="flex flex-col gap-1.5">
                        {row.newDocuments.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => void viewDocument(doc.id)}
                            className="inline-flex items-center gap-1.5 self-start rounded-full border-2 border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary transition-all duration-200 hover:scale-[1.03] hover:bg-primary-100"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {documentLabel(doc.documentType ?? '')}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      {resubmittedAt ? (
                        <>
                          <p className="text-slate-700">{formatDate(resubmittedAt)}</p>
                          <p className="text-xs text-slate-400">{formatRelativeTime(resubmittedAt)}</p>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <DotBadge tone={outcome.tone}>{outcome.label}</DotBadge>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
