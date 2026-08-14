import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import type { ApiResponse, WithdrawalRequest, WithdrawalStatus } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import type { BadgeTone } from '../components/Badge';
import { formatDateTime, formatMoney } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { receiptStatusTone, withdrawalStatusTone } from '../lib/badgeTones';
import { useSocketRefetch } from '../hooks/useSocketRefetch';

const STATUS_META: Record<WithdrawalStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'gray' },
  PENDING_PARENT_APPROVAL: { label: 'Awaiting Parent Approval', tone: 'yellow' },
  APPROVED: { label: 'Approved — Awaiting Dispense', tone: 'blue' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  COMPLETED: { label: 'Completed', tone: 'green' },
};

const STATUS_FILTERS: Array<{ key: WithdrawalStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'PENDING_PARENT_APPROVAL', label: 'Awaiting Parent Approval' },
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

  useSocketRefetch(load);

  const filtered = useMemo(
    () =>
      statusFilter === 'ALL'
        ? withdrawals
        : withdrawals.filter((request) => request.status === statusFilter),
    [withdrawals, statusFilter]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Withdrawal History" subtitle="All cash withdrawals dispensed to students" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title="Withdrawals"
        subtitle={`${filtered.length} shown`}
        actions={
          <FilterTabs tabs={STATUS_FILTERS.map((f) => ({ value: f.key, label: f.label }))} value={statusFilter} onChange={setStatusFilter} />
        }
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>Amount</th>
              <th className={TABLE_TH_CLASS}>Category</th>
              <th className={TABLE_TH_CLASS}>Date</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={<Inbox className="h-8 w-8" />}
                    title="No withdrawals in this status"
                    message="Withdrawals you dispense will show up here."
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              filtered.map((request, index) => {
                const statusMeta = STATUS_META[request.status];
                const receiptTone = request.receiptPath
                  ? receiptStatusTone[request.receiptVerificationStatus] ?? 'gray'
                  : 'gray';
                return (
                  <tr key={request.id} className={tableRowClass(index)}>
                    <td className={TABLE_TD_CLASS}>
                      <PersonCell name={request.wallet.user.fullName} email={request.wallet.user.email} />
                    </td>
                    <td className={`${TABLE_TD_CLASS} font-semibold text-slate-900`}>
                      {formatMoney(request.amount)}
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-slate-600`}>{humanizeEnum(request.category)}</td>
                    <td className={`${TABLE_TD_CLASS} text-slate-500`}>
                      {formatDateTime(request.completedAt ?? request.createdAt)}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <DotBadge tone={withdrawalStatusTone[request.status] ?? 'gray'}>
                        {statusMeta.label}
                      </DotBadge>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      {request.receiptPath ? (
                        <DotBadge tone={receiptTone}>{humanizeEnum(request.receiptVerificationStatus)}</DotBadge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {isLoading && withdrawals.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Loading withdrawal history…</p>
        )}
      </TableCard>
    </div>
  );
}
