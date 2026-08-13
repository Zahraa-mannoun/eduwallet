import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { roleTone } from '../lib/badgeTones';
import { formatDateTime } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/SkeletonRows';
import type { EmailChangeRequestRow } from '../types/admin';

type Tab = 'pending' | 'accepted';

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Email Change Requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Users requesting to change the email address on their account.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'pending'
              ? 'border-b-2 border-primary text-primary'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('accepted')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'accepted'
              ? 'border-b-2 border-primary text-primary'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Accepted ({accepted.length})
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Current Email</th>
              <th className="px-4 py-3 text-left">Requested Email</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Proof</th>
              <th className="px-4 py-3 text-left">Requested</th>
              {activeTab === 'accepted' && <th className="px-4 py-3 text-left">Resolved</th>}
              {activeTab === 'pending' && <th className="px-4 py-3 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={8} />}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState title={`No ${activeTab} email change requests`} />
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.user.fullName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={roleTone[row.user.userType] ?? 'gray'}>{humanizeEnum(row.user.userType)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.currentEmail}</td>
                  <td className="px-4 py-3 text-slate-600">{row.requestedEmail}</td>
                  <td className="px-4 py-3 max-w-xs text-slate-700">{row.reason}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void viewProof(row.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      View
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(row.createdAt)}</td>
                  {activeTab === 'accepted' && (
                    <td className="px-4 py-3 text-slate-500">
                      {row.resolvedAt ? formatDateTime(row.resolvedAt) : '—'}
                    </td>
                  )}
                  {activeTab === 'pending' && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setApproveTarget(row)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTarget(row)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
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
    <Modal title="Approve Email Change" onClose={onClose}>
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
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
    <Modal title="Reject Email Change" onClose={onClose}>
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
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Rejecting…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
