import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  Eye,
  EyeOff,
  Flag,
  Receipt,
  Store,
  Tag,
} from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { CustomSelect } from '../components/CustomSelect';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { receiptStatusTone, withdrawalStatusTone } from '../lib/badgeTones';
import { formatDateTime, formatMoney } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { WITHDRAWAL_STATUS_LABELS } from '../lib/transactionStatus';
import { WITHDRAWAL_STATUSES } from '../types/admin';
import type { ReceiptVerificationStatus, WithdrawalAdminRow, WithdrawalStatus } from '../types/admin';

type ReceiptFilterValue = ReceiptVerificationStatus | 'NOT_UPLOADED';

// Explicit order (not ReceiptVerificationStatus's own enum-declaration order) so "Pending
// Review" sits between "Flagged" and "Manually Verified" in the dropdown, rather than right
// after "Processing" where PENDING falls in RECEIPT_VERIFICATION_STATUSES's declared order.
const VISIBLE_RECEIPT_FILTER_VALUES: ReceiptFilterValue[] = [
  'NOT_UPLOADED',
  'PROCESSING',
  'AUTO_VERIFIED',
  'FLAGGED',
  'PENDING',
  'MANUALLY_VERIFIED',
  'REJECTED',
];

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
  if (status === 'PENDING') return 'Pending Review';
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
        className="max-h-64 rounded-lg border border-slate-200 object-contain"
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

  // CustomSelect manages its own trigger's focus/open state internally — only the date inputs
  // (still native <input type="date">) need the border color tracked here, for the same reason
  // as before: a single inline `border` shorthand can't respond to a CSS :focus class.
  const [dateFromFocused, setDateFromFocused] = useState(false);
  const [dateToFocused, setDateToFocused] = useState(false);

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
  useSocketRefetch(load);

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
      // row.createdAt is a UTC ISO timestamp; dateFrom/dateTo are local calendar dates from the
      // <input type="date"> pickers — slicing the raw UTC string reads the UTC calendar date,
      // which drifts from the local one whenever local time crosses a day boundary UTC doesn't
      // (e.g. Lebanon UTC+3). toLocaleDateString('en-CA') resolves to the browser's local date
      // in the same YYYY-MM-DD shape the date inputs already use, so the two compare correctly.
      const rowDate = new Date(row.createdAt).toLocaleDateString('en-CA');
      if (dateFrom && rowDate < dateFrom) return false;
      if (dateTo && rowDate > dateTo) return false;
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
      <PageHeader title="Agent Withdrawals" subtitle="Every cash withdrawal dispensed by an agent, with receipt verification status" />

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-end', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="status-filter" style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>
              Status
            </label>
            <CustomSelect
              id="status-filter"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as WithdrawalStatus | 'ALL')}
              options={[
                { value: 'ALL', label: 'All statuses' },
                ...WITHDRAWAL_STATUSES.map((s) => ({
                  value: s,
                  label: WITHDRAWAL_STATUS_LABELS[s] ?? humanizeEnum(s),
                })),
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="receipt-filter" style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>
              Receipt Status
            </label>
            <CustomSelect
              id="receipt-filter"
              value={receiptFilter}
              onChange={(value) => setReceiptFilter(value as ReceiptFilterValue | 'ALL')}
              options={[
                { value: 'ALL', label: 'All receipt statuses' },
                ...VISIBLE_RECEIPT_FILTER_VALUES.map((s) => ({ value: s, label: receiptStatusLabel(s) })),
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="date-from" style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>
              From
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar
                size={16}
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                }}
              />
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                onFocus={() => setDateFromFocused(true)}
                onBlur={() => setDateFromFocused(false)}
                className="[&::-webkit-calendar-picker-indicator]:opacity-0"
                style={{
                  border: dateFromFocused ? '1.5px solid #6D28D9' : '1.5px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '8px 14px 8px 36px',
                  fontSize: '14px',
                  color: '#1E293B',
                  backgroundColor: 'white',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="date-to" style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>
              To
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar
                size={16}
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                }}
              />
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                onFocus={() => setDateToFocused(true)}
                onBlur={() => setDateToFocused(false)}
                className="[&::-webkit-calendar-picker-indicator]:opacity-0"
                style={{
                  border: dateToFocused ? '1.5px solid #6D28D9' : '1.5px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '8px 14px 8px 36px',
                  fontSize: '14px',
                  color: '#1E293B',
                  backgroundColor: 'white',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-pressed={flaggedOnly}
            onClick={() => setFlaggedOnly((value) => !value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setFlaggedOnly((value) => !value);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '999px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              userSelect: 'none',
              border: '1.5px solid #F59E0B',
              background: flaggedOnly ? '#F59E0B' : 'white',
              color: flaggedOnly ? '#FFFFFF' : '#F59E0B',
            }}
          >
            <Flag size={14} />
            Flagged only
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title="Withdrawals" subtitle={`${filtered.length} shown`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>Agent</th>
              <th className={TABLE_TH_CLASS}>Amount</th>
              <th className={TABLE_TH_CLASS}>Category</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Receipt</th>
              <th className={TABLE_TH_CLASS}>Date</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={8} />}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon={<Banknote className="h-8 w-8" />}
                    title="No withdrawals match these filters"
                    message="Try adjusting the filters above."
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((row, index) => {
                const receiptStatus = receiptStatusFor(row);
                const expanded = expandedId === row.id;
                const decisions = row.receiptPath ? AVAILABLE_DECISIONS[row.receiptVerificationStatus] : [];
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => void toggleExpand(row)}
                      className={tableRowClass(index, 'cursor-pointer')}
                    >
                      <td className={TABLE_TD_CLASS}>
                        <PersonCell name={row.wallet.user.fullName} email={row.wallet.user.email} />
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-slate-700`}>
                        {row.agent ? row.agent.fullName : '—'}
                      </td>
                      <td className={`${TABLE_TD_CLASS} font-semibold text-slate-900`}>
                        {formatMoney(row.amount, 'USD')}
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-slate-600`}>{humanizeEnum(row.category)}</td>
                      <td className={TABLE_TD_CLASS}>
                        <DotBadge tone={withdrawalStatusTone[row.status] ?? 'gray'}>
                          {WITHDRAWAL_STATUS_LABELS[row.status] ?? row.status}
                        </DotBadge>
                      </td>
                      <td className={TABLE_TD_CLASS}>
                        <DotBadge tone={receiptStatusTone[receiptStatus] ?? 'gray'}>
                          {receiptStatusLabel(receiptStatus)}
                        </DotBadge>
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-slate-500`}>
                        {formatDateTime(row.completedAt ?? row.createdAt)}
                      </td>
                      <td className={TABLE_TD_CLASS}>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {expanded ? 'Hide' : 'View'}
                        </span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={8} className="bg-slate-50/70 px-6 py-5">
                          {receiptStatus === 'FLAGGED' && (
                            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              This receipt was flagged — the detected merchant category doesn&apos;t match
                              the declared withdrawal category.
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div className="rounded-xl border border-dashed border-slate-300 bg-[#FAFAFA] p-4">
                              <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                                  <Receipt className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-mono text-xs font-semibold text-slate-700">
                                    RECEIPT #{row.id.slice(0, 8).toUpperCase()}
                                  </p>
                                  <p className="font-mono text-[11px] text-slate-400">
                                    {formatDateTime(row.completedAt ?? row.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="font-mono">
                                {renderReceiptPreview(row, isReceiptLoading, receiptImageUrl)}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Detection Notes
                                </h3>
                                <dl className="space-y-2.5 text-sm">
                                  <div className="flex items-center justify-between gap-4">
                                    <dt className="flex items-center gap-1.5 text-slate-400">
                                      <Store className="h-3.5 w-3.5" />
                                      Merchant
                                    </dt>
                                    <dd className="font-medium text-slate-700">{row.merchantName ?? '—'}</dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <dt className="flex items-center gap-1.5 text-slate-400">
                                      <Tag className="h-3.5 w-3.5" />
                                      Detected Category
                                    </dt>
                                    <dd className="font-medium text-slate-700">
                                      {row.detectedCategory ? humanizeEnum(row.detectedCategory) : '—'}
                                    </dd>
                                  </div>
                                  {row.receiptVerificationNote && (
                                    <div className="border-t border-slate-100 pt-2.5">
                                      <dt className="mb-1 text-slate-400">Note</dt>
                                      <dd className="text-slate-600">{row.receiptVerificationNote}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>

                              {row.receiptPath && decisions.length > 0 && (
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <label
                                    htmlFor={`note-${row.id}`}
                                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                                  >
                                    Review Note (optional)
                                  </label>
                                  <textarea
                                    id={`note-${row.id}`}
                                    rows={2}
                                    value={noteDraft}
                                    onChange={(event) => setNoteDraft(event.target.value)}
                                    className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm transition-colors focus:border-blue-400 focus:outline-none"
                                  />

                                  {actionError && (
                                    <p className="mt-2 text-sm text-red-600">{actionError}</p>
                                  )}

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {decisions.map((decision) => {
                                      const isPrimary = decision === 'VERIFIED';
                                      const isReject = decision === 'REJECTED';
                                      return (
                                        <button
                                          key={decision}
                                          type="button"
                                          disabled={pendingDecision !== null}
                                          onClick={() => void handleDecision(row, decision)}
                                          className={
                                            isPrimary
                                              ? 'rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-700 disabled:opacity-50 disabled:hover:scale-100'
                                              : isReject
                                                ? 'rounded-xl border-2 border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 transition-all duration-200 hover:scale-[1.02] hover:bg-red-50 disabled:opacity-50 disabled:hover:scale-100'
                                                : 'rounded-xl border-2 border-amber-300 px-5 py-2.5 text-sm font-semibold text-amber-700 transition-all duration-200 hover:scale-[1.02] hover:bg-amber-50 disabled:opacity-50 disabled:hover:scale-100'
                                          }
                                        >
                                          {pendingDecision === decision ? 'Saving…' : DECISION_LABEL[decision]}
                                        </button>
                                      );
                                    })}
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
      </TableCard>
    </div>
  );
}
