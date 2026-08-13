import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ApiResponse, KYCStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import type { BadgeTone } from '../components/Badge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDate } from '../lib/format';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/SkeletonRows';
import type { ResubmissionRow } from '../types/admin';

function latestDate(dates: string[]): string | null {
  return dates.length > 0 ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const OUTCOME_META: Record<KYCStatus, { label: string; tone: BadgeTone }> = {
  VERIFIED: { label: 'Verified', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  PENDING: { label: 'Pending', tone: 'yellow' },
};

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
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Resubmissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Permanent history of every student who was rejected and later resubmitted documents.
          Review decisions are made from the KYC Review page — this log is read-only and keeps a
          row here regardless of the final outcome.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-48 px-4 py-3 text-left whitespace-nowrap">Student</th>
              <th className="w-56 px-4 py-3 text-left whitespace-nowrap">Previous Rejection Reason</th>
              <th className="w-48 px-4 py-3 text-left whitespace-nowrap">Old Documents</th>
              <th className="w-48 px-4 py-3 text-left whitespace-nowrap">New Documents</th>
              <th className="w-28 px-4 py-3 text-left whitespace-nowrap">Resubmitted</th>
              <th className="w-24 px-4 py-3 text-left whitespace-nowrap">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={6} />}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="No resubmissions yet" />
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row) => {
                const resubmittedAt = latestDate(row.newDocuments.map((doc) => doc.createdAt));
                const isHighlighted = row.id === highlightUserId;
                const outcome = OUTCOME_META[row.kycStatus];
                return (
                  <tr
                    key={row.id}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    className={isHighlighted ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : 'hover:bg-slate-50'}
                  >
                    <td className="w-48 px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">{row.fullName}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </td>
                    <td className="w-56 px-4 py-3 align-top text-slate-600">
                      {row.kycRejectionReason ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="w-48 px-4 py-3 align-top">
                      {row.oldDocuments.length > 0 ? (
                        <div className="flex flex-col items-start gap-1.5">
                          {row.oldDocuments.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => void viewDocument(doc.id)}
                              className="whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              View {doc.documentType === 'STUDENT_ID' ? 'Student ID' : 'Enrollment Cert.'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">None on file</span>
                      )}
                    </td>
                    <td className="w-48 px-4 py-3 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        {row.newDocuments.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => void viewDocument(doc.id)}
                            className="whitespace-nowrap rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-100"
                          >
                            View {doc.documentType === 'STUDENT_ID' ? 'Student ID' : 'Enrollment Cert.'}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="w-28 px-4 py-3 align-top text-slate-500 whitespace-nowrap">
                      {resubmittedAt ? (
                        <>
                          <div>{formatDate(resubmittedAt)}</div>
                          <div className="text-xs text-slate-400">{formatTime(resubmittedAt)}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="w-24 px-4 py-3 align-top">
                      <Badge tone={outcome.tone}>{outcome.label}</Badge>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
