import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, FileText, Mail, X } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import type { BadgeTone } from '../components/Badge';
import { DotBadge } from '../components/DotBadge';
import { Modal } from '../components/Modal';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { roleTone } from '../lib/badgeTones';
import { formatDateTime } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import type { EmailChangeRequestRow, EmailChangeStatus } from '../types/admin';

type Tab = 'pending' | 'accepted';

const STATUS_TONE: Record<EmailChangeStatus, BadgeTone> = {
  PENDING: 'yellow',
  ACCEPTED: 'green',
  REJECTED: 'red',
};

export function EmailChangeRequests() {
  const [pending, setPending] = useState<EmailChangeRequestRow[]>([]);
  const [accepted, setAccepted] = useState<EmailChangeRequestRow[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<EmailChangeRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<EmailChangeRequestRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<
        ApiResponse<{ pending: EmailChangeRequestRow[]; accepted: EmailChangeRequestRow[] }>
      >('/email-change/requests');
      const data = unwrap(response.data);
      setPending(data.pending);
      setAccepted(data.accepted);
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

  const viewProof = async (requestId: string) => {
    try {
      const response = await api.get(`/email-change/requests/${requestId}/proof`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const rows = activeTab === 'pending' ? pending : accepted;
  const columnCount = activeTab === 'pending' ? 7 : 6;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Email Change Requests"
        subtitle="Users requesting to change the email address on their account"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title={activeTab === 'pending' ? 'Pending Requests' : 'Resolved Requests'}
        subtitle={`${rows.length} shown`}
        actions={
          <FilterTabs
            tabs={[
              { value: 'pending', label: `Pending (${pending.length})` },
              { value: 'accepted', label: `Accepted (${accepted.length})` },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        }
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>User</th>
              <th className={TABLE_TH_CLASS}>Email Change</th>
              <th className={TABLE_TH_CLASS}>Reason</th>
              <th className={TABLE_TH_CLASS}>Proof</th>
              <th className={TABLE_TH_CLASS}>Requested</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              {activeTab === 'pending' && <th className={TABLE_TH_CLASS}>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={columnCount} />}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={columnCount}>
                  <EmptyState
                    icon={<Mail className="h-8 w-8" />}
                    title={`No ${activeTab} email change requests`}
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row, index) => (
                <tr key={row.id} className={tableRowClass(index)}>
                  <td className={TABLE_TD_CLASS}>
                    <PersonCell
                      name={row.user.fullName}
                      email={row.user.email}
                      extra={
                        <Badge tone={roleTone[row.user.userType] ?? 'gray'}>
                          {humanizeEnum(row.user.userType)}
                        </Badge>
                      }
                    />
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    <div className="flex max-w-xs items-center gap-1.5 text-sm">
                      <span className="text-slate-500">{row.currentEmail}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="font-medium text-slate-900">{row.requestedEmail}</span>
                    </div>
                  </td>
                  <td className={`${TABLE_TD_CLASS} max-w-xs truncate text-slate-500`}>{row.reason}</td>
                  <td className={TABLE_TD_CLASS}>
                    <button
                      type="button"
                      onClick={() => void viewProof(row.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.03] hover:bg-slate-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View Proof
                    </button>
                  </td>
                  <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDateTime(row.createdAt)}</td>
                  <td className={TABLE_TD_CLASS}>
                    <DotBadge tone={STATUS_TONE[row.status]}>{humanizeEnum(row.status)}</DotBadge>
                  </td>
                  {activeTab === 'pending' && (
                    <td className={TABLE_TD_CLASS}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setApproveTarget(row)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTarget(row)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition-all duration-200 hover:scale-[1.03] hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
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
  row: EmailChangeRequestRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.patch(`/email-change/requests/${row.id}/approve`);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Approve Email Change" tone="success" icon={<Check className="h-6 w-6 text-white" />} onClose={onClose}>
      <p className="text-sm text-slate-600">
        Are you sure you want to change {row.user.fullName}&apos;s email to{' '}
        <span className="font-medium text-slate-900">{row.requestedEmail}</span>? They will need
        to log in again with the new email.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-700 disabled:opacity-60"
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
  row: EmailChangeRequestRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.patch(`/email-change/requests/${row.id}/reject`);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Reject Email Change" tone="danger" icon={<X className="h-6 w-6 text-white" />} onClose={onClose}>
      <p className="text-sm text-slate-600">
        Are you sure you want to reject {row.user.fullName}&apos;s request to change their email
        to <span className="font-medium text-slate-900">{row.requestedEmail}</span>?
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-red-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Rejecting…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
