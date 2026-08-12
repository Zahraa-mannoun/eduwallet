import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiResponse, WithdrawalRequest, WithdrawalStatus } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import type { BadgeTone } from '../components/Badge';
import { formatDateTime, formatMoney } from '../lib/format';
import { IconInbox } from '../components/icons';

const STATUS_META: Record<WithdrawalStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'gray' },
  PENDING_PARENT_APPROVAL: { label: 'Awaiting Parent', tone: 'yellow' },
  APPROVED: { label: 'Approved — Awaiting Dispense', tone: 'blue' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  COMPLETED: { label: 'Completed', tone: 'green' },
};

const STATUS_FILTERS: Array<{ key: WithdrawalStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'PENDING_PARENT_APPROVAL', label: 'Awaiting Parent' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

export function WithdrawalHistory() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'ALL'>('COMPLETED');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiResponse<WithdrawalRequest[]>>('/withdrawals');
      setWithdrawals(unwrap(res.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      statusFilter === 'ALL'
        ? withdrawals
        : withdrawals.filter((request) => request.status === statusFilter),
    [withdrawals, statusFilter]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Withdrawal History</h1>
        <p className="mt-1 text-sm text-slate-500">All cash withdrawals dispensed to students.</p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setStatusFilter(filter.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === filter.key
                ? 'bg-primary text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {!isLoading && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
            <IconInbox className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">No withdrawals in this status</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            Withdrawals you dispense will show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((request) => {
                const statusMeta = STATUS_META[request.status];
                return (
                  <tr key={request.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{request.wallet.user.fullName}</div>
                      <div className="text-xs text-slate-500">{request.wallet.user.email}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatMoney(request.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{request.category}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateTime(request.completedAt ?? request.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {request.receiptPath ? request.receiptVerificationStatus : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isLoading && withdrawals.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Loading withdrawal history…</p>
          )}
        </div>
      )}
    </div>
  );
}
