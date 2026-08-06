import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AcademicDocument, ApiResponse, KYCStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { IconChevronRight } from '../components/icons';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { getKycDisplayStatus } from '../lib/kycDisplayStatus';
import { formatDate } from '../lib/format';
import type { PendingKYCRow } from '../types/admin';

type KYCStudentRow = {
  userId: string;
  studentName: string;
  studentEmail: string;
  kycStatus: KYCStatus;
  studentIdDoc: AcademicDocument | null;
  enrollmentDoc: AcademicDocument | null;
  hasDocuments: boolean;
  hasResubmitted: boolean;
  submittedAt: string;
};

type FilterTab = 'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED' | 'VERIFIED' | 'REJECTED';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'ALL', label: 'All Students' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'NOT_SUBMITTED', label: 'Not Submitted' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
];

function toStudentRow(user: PendingKYCRow): KYCStudentRow {
  const studentIdDoc = user.documents.find((doc) => doc.documentType === 'STUDENT_ID') ?? null;
  const enrollmentDoc =
    user.documents.find((doc) => doc.documentType === 'ENROLLMENT_CERTIFICATE') ?? null;
  const submittedAt = user.documents.reduce<string>(
    (latest, doc) => (doc.createdAt > latest ? doc.createdAt : latest),
    user.createdAt
  );
  return {
    userId: user.id,
    studentName: user.fullName,
    studentEmail: user.email,
    kycStatus: user.kycStatus,
    studentIdDoc,
    enrollmentDoc,
    hasDocuments: user.documents.length > 0,
    hasResubmitted: user.hasResubmitted,
    submittedAt,
  };
}

type KYCActionState = {
  approveDisabled: boolean;
  rejectDisabled: boolean;
  approveTooltip?: string;
  rejectTooltip?: string;
  helperText?: string;
};

const NOT_SUBMITTED_TOOLTIP = 'Student has not submitted documents yet';

function getKycActionState(row: KYCStudentRow): KYCActionState {
  if (row.kycStatus === 'VERIFIED') {
    const tooltip = 'This student has already been verified — the decision cannot be changed';
    return {
      approveDisabled: true,
      rejectDisabled: true,
      approveTooltip: tooltip,
      rejectTooltip: tooltip,
      helperText: 'KYC approved',
    };
  }
  if (row.kycStatus === 'REJECTED') {
    const tooltip = 'This student has already been rejected — the decision cannot be changed';
    return {
      approveDisabled: true,
      rejectDisabled: true,
      approveTooltip: tooltip,
      rejectTooltip: tooltip,
      helperText: 'KYC rejected',
    };
  }
  if (!row.hasDocuments) {
    return {
      approveDisabled: true,
      rejectDisabled: true,
      approveTooltip: NOT_SUBMITTED_TOOLTIP,
      rejectTooltip: NOT_SUBMITTED_TOOLTIP,
      helperText: 'No documents uploaded yet',
    };
  }
  return { approveDisabled: false, rejectDisabled: false };
}

function matchesFilter(row: KYCStudentRow, filter: FilterTab): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'SUBMITTED':
      return row.hasDocuments && row.kycStatus === 'PENDING';
    case 'NOT_SUBMITTED':
      return !row.hasDocuments;
    case 'VERIFIED':
      return row.kycStatus === 'VERIFIED';
    case 'REJECTED':
      return row.kycStatus === 'REJECTED';
    default:
      return true;
  }
}

export function KYC() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<KYCStudentRow[]>([]);
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<KYCStudentRow | null>(null);
  const [approveTarget, setApproveTarget] = useState<KYCStudentRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<PendingKYCRow[]>>('/kyc/pending');
      const users = unwrap(response.data);
      setRows(users.map(toStudentRow));
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

  const visibleRows = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [rows, filter]);

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
      <div className="flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === tab.value
                ? 'bg-primary text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Student Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">KYC Status</th>
              <th className="px-4 py-3 text-left">Documents</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No students match this filter
                </td>
              </tr>
            )}
            {!isLoading &&
              visibleRows.map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>{row.studentName}</span>
                      {row.hasResubmitted && (
                        <>
                          <span
                            title="Resubmitted new documents after a rejection"
                            className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-xs"
                          >
                            🔄
                          </span>
                          <button
                            type="button"
                            title="View in Resubmissions"
                            onClick={() => navigate(`/resubmissions?highlight=${row.userId}`)}
                            className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <IconChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.studentEmail}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const status = getKycDisplayStatus(row.kycStatus, row.hasDocuments);
                      return <Badge tone={status.tone}>{status.label}</Badge>;
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {row.hasDocuments ? (
                      <div className="flex flex-wrap gap-2">
                        {row.studentIdDoc ? (
                          <button
                            type="button"
                            onClick={() => void viewDocument(row.studentIdDoc!.id)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            View Student ID
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Student ID not uploaded</span>
                        )}
                        {row.enrollmentDoc ? (
                          <button
                            type="button"
                            onClick={() => void viewDocument(row.enrollmentDoc!.id)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            View Enrollment Certificate
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Enrollment certificate not uploaded
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No documents uploaded yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(row.submittedAt)}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const actionState = getKycActionState(row);
                      return (
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={actionState.approveDisabled}
                              onClick={() => setApproveTarget(row)}
                              title={actionState.approveTooltip}
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionState.rejectDisabled}
                              onClick={() => setRejectTarget(row)}
                              title={actionState.rejectTooltip}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </div>
                          {actionState.helperText && (
                            <p className="mt-1 text-xs text-slate-400">{actionState.helperText}</p>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {approveTarget && (
        <ApproveModal
          row={approveTarget}
          onClose={() => setApproveTarget(null)}
          onDone={() => {
            setApproveTarget(null);
            void load();
          }}
        />
      )}

      {rejectTarget && (
        <RejectModal
          row={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ApproveModal({
  row,
  onClose,
  onDone,
}: {
  row: KYCStudentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/kyc/review', { userId: row.userId, decision: 'APPROVED' });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Approve KYC — ${row.studentName}`} onClose={onClose}>
      <p className="text-sm text-slate-600">
        Are you sure you want to approve {row.studentName}&apos;s KYC verification? This decision
        cannot be changed afterward.
      </p>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Approving…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({
  row,
  onClose,
  onDone,
}: {
  row: KYCStudentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('A reason is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/kyc/review', { userId: row.userId, decision: 'REJECTED', reason });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject KYC — ${row.studentName}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="reason" className="mb-1 block text-sm font-medium text-slate-700">
            Reason
          </label>
          <textarea
            id="reason"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
