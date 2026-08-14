import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, FileText, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { AcademicDocument, ApiResponse, KYCStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { getKycDisplayStatus } from '../lib/kycDisplayStatus';
import { formatDate } from '../lib/format';
import type { PendingKYCRow } from '../types/admin';

type KYCStudentRow = {
  userId: string;
  studentName: string;
  studentEmail: string;
  kycStatus: KYCStatus;
  kycRejectionReason: string | null;
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
    kycRejectionReason: user.kycRejectionReason,
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
  decidedLabel?: string;
  decidedTone?: 'green' | 'red' | 'gray';
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
      decidedLabel: 'KYC Approved',
      decidedTone: 'green',
    };
  }
  if (row.kycStatus === 'REJECTED') {
    const tooltip = 'This student has already been rejected — the decision cannot be changed';
    return {
      approveDisabled: true,
      rejectDisabled: true,
      approveTooltip: tooltip,
      rejectTooltip: tooltip,
      decidedLabel: 'KYC Rejected',
      decidedTone: 'red',
    };
  }
  if (!row.hasDocuments) {
    return {
      approveDisabled: true,
      rejectDisabled: true,
      approveTooltip: NOT_SUBMITTED_TOOLTIP,
      rejectTooltip: NOT_SUBMITTED_TOOLTIP,
      decidedLabel: 'No Documents',
      decidedTone: 'gray',
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
  useSocketRefetch(load);

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
      <PageHeader title="KYC Review" subtitle="Verify student identity documents" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title="Students"
        subtitle={`${visibleRows.length} shown`}
        actions={<FilterTabs tabs={FILTER_TABS} value={filter} onChange={setFilter} />}
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>KYC Status</th>
              <th className={TABLE_TH_CLASS}>Documents</th>
              <th className={TABLE_TH_CLASS}>Submitted</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} />}
            {!isLoading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="No students match this filter" />
                </td>
              </tr>
            )}
            {!isLoading &&
              visibleRows.map((row, index) => (
                <tr key={row.userId} className={tableRowClass(index)}>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    <PersonCell
                      name={row.studentName}
                      email={row.studentEmail}
                      extra={
                        row.hasResubmitted && (
                          <button
                            type="button"
                            title="Has resubmission — click to view"
                            onClick={() => navigate(`/resubmissions?highlight=${row.userId}`)}
                            className="group rounded-lg p-0.5 text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                          >
                            <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:animate-spin" />
                          </button>
                        )
                      }
                    />
                  </td>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    {(() => {
                      const status = getKycDisplayStatus(row.kycStatus, row.hasDocuments);
                      return (
                        <div>
                          <DotBadge tone={status.tone}>{status.label}</DotBadge>
                          {row.kycStatus === 'REJECTED' && row.kycRejectionReason && (
                            <p className="mt-1.5 flex max-w-[220px] items-start gap-1 text-xs italic text-red-400">
                              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                              {row.kycRejectionReason}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    {row.hasDocuments ? (
                      <div className="flex flex-wrap gap-2">
                        {row.studentIdDoc ? (
                          <button
                            type="button"
                            onClick={() => void viewDocument(row.studentIdDoc!.id)}
                            className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-all duration-200 hover:scale-[1.03] hover:border-primary-200 hover:bg-primary-50 hover:text-primary"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Student ID
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Student ID not uploaded</span>
                        )}
                        {row.enrollmentDoc ? (
                          <button
                            type="button"
                            onClick={() => void viewDocument(row.enrollmentDoc!.id)}
                            className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-all duration-200 hover:scale-[1.03] hover:border-primary-200 hover:bg-primary-50 hover:text-primary"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Enrollment Cert.
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
                  <td className={`${TABLE_TD_CLASS} align-top text-slate-500`}>{formatDate(row.submittedAt)}</td>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    {(() => {
                      const actionState = getKycActionState(row);
                      if (actionState.decidedLabel) {
                        return <DotBadge tone={actionState.decidedTone ?? 'gray'}>{actionState.decidedLabel}</DotBadge>;
                      }
                      return (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setApproveTarget(row)}
                            title={actionState.approveTooltip}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTarget(row)}
                            title={actionState.rejectTooltip}
                            className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-300 px-3 py-1 text-xs font-semibold text-red-600 transition-all duration-200 hover:scale-[1.03] hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableCard>

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
    <Modal
      title="Approve KYC"
      subtitle={row.studentName}
      icon={<Check className="h-6 w-6 text-white" />}
      tone="success"
      onClose={onClose}
    >
      <p className="text-sm text-slate-600">
        Are you sure you want to approve {row.studentName}&apos;s KYC verification? This decision
        cannot be changed afterward.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-xl border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-50 disabled:opacity-60 disabled:hover:scale-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-700 disabled:opacity-60 disabled:hover:scale-100"
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
    <Modal
      title="Reject KYC"
      subtitle={row.studentName}
      icon={<X className="h-6 w-6 text-white" />}
      tone="danger"
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-slate-700">
            Reason
          </label>
          <textarea
            id="reason"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm transition-colors focus:border-blue-400 focus:outline-none"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-red-700 disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
