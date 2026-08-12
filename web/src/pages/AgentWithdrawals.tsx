import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { receiptStatusTone, withdrawalStatusTone } from '../lib/badgeTones';
import { formatDateTime, formatMoney } from '../lib/format';
import {
  RECEIPT_VERIFICATION_STATUSES,
  WITHDRAWAL_STATUSES,
} from '../types/admin';
import type { ReceiptVerificationStatus, WithdrawalAdminRow, WithdrawalStatus } from '../types/admin';

type ReceiptFilterValue = ReceiptVerificationStatus | 'NOT_UPLOADED';

const RECEIPT_FILTER_VALUES: ReceiptFilterValue[] = ['NOT_UPLOADED', ...RECEIPT_VERIFICATION_STATUSES];

type Decision = 'VERIFIED' | 'FLAGGED' | 'REJECTED';

const DECISION_LABEL: Record<Decision, string> = {
  VERIFIED: 'Mark as Verified',
  FLAGGED: 'Flag',
  REJECTED: 'Reject',
};

// Which decisions make sense from each current receipt status — PROCESSING is still being
// OCR'd and has no verdict to act on yet, MANUALLY_VERIFIED/REJECTED are final states with no
// further action, AUTO_VERIFIED only allows the rare admin override (Flag), and PENDING/FLAGGED
// both still need a human call (Verify or Reject).
const AVAILABLE_DECISIONS: Record<ReceiptVerificationStatus, Decision[]> = {
  PROCESSING: [],
  PENDING: ['VERIFIED', 'REJECTED'],
  FLAGGED: ['VERIFIED', 'REJECTED'],
  AUTO_VERIFIED: ['FLAGGED'],
  MANUALLY_VERIFIED: [],
  REJECTED: [],
};

// receiptVerificationStatus defaults to PENDING before a receipt even exists, so "no receipt
// yet" and "receipt uploaded but auto-detection was inconclusive" are otherwise indistinguishable
// — this derived status is what every filter/badge in this page actually keys off.
function receiptStatusFor(row: WithdrawalAdminRow): ReceiptFilterValue {
  return row.receiptPath ? row.receiptVerificationStatus : 'NOT_UPLOADED';
}

function receiptStatusLabel(status: ReceiptFilterValue): string {
  if (status === 'NOT_UPLOADED') return 'Not Uploaded';
  if (status === 'AUTO_VERIFIED') return 'Auto Verified';
  if (status === 'MANUALLY_VERIFIED') return 'Manually Verified';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function renderReceiptPreview(
  row: WithdrawalAdminRow,
  isLoading: boolean,
  imageUrl: string | null
) {
  if (!row.receiptPath) {
    return <p className="text-sm text-slate-400">No receipt uploaded yet.</p>;
  }
  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading receipt…</p>;
  }
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Uploaded receipt"
        className="max-h-64 rounded-md border border-slate-200 object-contain"
      />
    );
  }
  return <p className="text-sm text-red-600">Could not load the receipt image.</p>;
}

export function AgentWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalAdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'ALL'>('ALL');
  const [receiptFilter, setReceiptFilter] = useState<ReceiptFilterValue | 'ALL'>('ALL');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<WithdrawalAdminRow[]>>('/withdrawals/admin');
      setWithdrawals(unwrap(response.data));
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

  // Revokes the previous blob URL whenever the expanded row changes or the page unmounts —
  // otherwise every receipt preview leaks its object URL for the life of the tab.
  useEffect(() => {
    return () => {
      if (receiptImageUrl) {
        URL.revokeObjectURL(receiptImageUrl);
      }
    };
  }, [receiptImageUrl]);

  const filtered = useMemo(() => {
    return withdrawals.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      const receiptStatus = receiptStatusFor(row);
      if (flaggedOnly && receiptStatus !== 'FLAGGED') return false;
      if (receiptFilter !== 'ALL' && receiptStatus !== receiptFilter) return false;
      if (dateFrom && row.createdAt < dateFrom) return false;
      if (dateTo && row.createdAt.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [withdrawals, statusFilter, receiptFilter, flaggedOnly, dateFrom, dateTo]);

  const toggleExpand = async (row: WithdrawalAdminRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      setReceiptImageUrl(null);
      setActionError(null);
      return;
    }

    setExpandedId(row.id);
    setNoteDraft(row.receiptVerificationNote ?? '');
    setActionError(null);
    setReceiptImageUrl(null);

    if (row.receiptPath) {
      setIsReceiptLoading(true);
      try {
        const response = await api.get(`/withdrawals/${row.id}/receipt-file`, {
          responseType: 'blob',
        });
        setReceiptImageUrl(URL.createObjectURL(response.data as Blob));
      } catch (err) {
        setActionError(getErrorMessage(err));
      } finally {
        setIsReceiptLoading(false);
      }
    }
  };

  const handleDecision = async (row: WithdrawalAdminRow, decision: Decision) => {
    setPendingDecision(decision);
    setActionError(null);
    try {
      await api.patch(`/withdrawals/${row.id}/verify-receipt`, {
        decision,
        note: noteDraft.trim() || undefined,
      });
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setPendingDecision(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Agent Withdrawals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every cash withdrawal dispensed by an agent, with receipt verification status.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as WithdrawalStatus | 'ALL')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All statuses</option>
            {WITHDRAWAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="receipt-filter" className="mb-1 block text-xs font-medium text-slate-600">
            Receipt Status
          </label>
          <select
            id="receipt-filter"
            value={receiptFilter}
            onChange={(event) => setReceiptFilter(event.target.value as ReceiptFilterValue | 'ALL')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All receipt statuses</option>
            {RECEIPT_FILTER_VALUES.map((s) => (
              <option key={s} value={s}>
                {receiptStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date-from" className="mb-1 block text-xs font-medium text-slate-600">
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="date-to" className="mb-1 block text-xs font-medium text-slate-600">
            To
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(event) => setFlaggedOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          Flagged only
        </label>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Agent</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Receipt</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No withdrawals match these filters
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((row) => {
                const receiptStatus = receiptStatusFor(row);
                const expanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => void toggleExpand(row)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.wallet.user.fullName}</div>
                        <div className="text-xs text-slate-500">{row.wallet.user.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.agent ? row.agent.fullName : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatMoney(row.amount, 'USD')}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.category}</td>
                      <td className="px-4 py-3">
                        <Badge tone={withdrawalStatusTone[row.status] ?? 'gray'}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={receiptStatusTone[receiptStatus] ?? 'gray'}>
                          {receiptStatusLabel(receiptStatus)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(row.completedAt ?? row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-primary">{expanded ? 'Hide' : 'View'}</td>
                    </tr>
                    {expanded && (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={8} className="bg-slate-50 px-4 py-4">
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                Receipt
                              </h3>
                              {renderReceiptPreview(row, isReceiptLoading, receiptImageUrl)}
                            </div>

                            <div className="space-y-3">
                              <div>
                                <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">
                                  Detection Notes
                                </h3>
                                <dl className="space-y-1 text-sm text-slate-600">
                                  <div className="flex justify-between gap-4">
                                    <dt className="text-slate-400">Merchant</dt>
                                    <dd>{row.merchantName ?? '—'}</dd>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <dt className="text-slate-400">Detected Category</dt>
                                    <dd>{row.detectedCategory ?? '—'}</dd>
                                  </div>
                                  {row.receiptVerificationNote && (
                                    <div>
                                      <dt className="text-slate-400">Note</dt>
                                      <dd className="mt-0.5">{row.receiptVerificationNote}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>

                              {row.receiptPath &&
                                AVAILABLE_DECISIONS[row.receiptVerificationStatus].length > 0 && (
                                  <div>
                                    <label
                                      htmlFor={`note-${row.id}`}
                                      className="mb-1 block text-xs font-semibold uppercase text-slate-500"
                                    >
                                      Review Note (optional)
                                    </label>
                                    <textarea
                                      id={`note-${row.id}`}
                                      rows={2}
                                      value={noteDraft}
                                      onChange={(event) => setNoteDraft(event.target.value)}
                                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    />

                                    {actionError && (
                                      <p className="mt-2 text-sm text-red-600">{actionError}</p>
                                    )}

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {AVAILABLE_DECISIONS[row.receiptVerificationStatus].map(
                                        (decision) => (
                                          <button
                                            key={decision}
                                            type="button"
                                            disabled={pendingDecision !== null}
                                            onClick={() => void handleDecision(row, decision)}
                                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                          >
                                            {pendingDecision === decision
                                              ? 'Saving…'
                                              : DECISION_LABEL[decision]}
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
