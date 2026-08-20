import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, PiggyBank } from 'lucide-react';
import type { AgentSavingsWithdrawalRow, ApiResponse } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SearchInput } from '../components/SearchInput';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { formatDateTime, formatMoney } from '../lib/format';

type Tab = 'pending' | 'dispensed' | 'all';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'pending', label: 'Pending Dispense' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'all', label: 'All' },
];

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isThisMonth(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function DispenseConfirmModal({
  withdrawal,
  onClose,
  onDispensed,
}: {
  withdrawal: AgentSavingsWithdrawalRow;
  onClose: () => void;
  onDispensed: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/agent/savings-withdrawals/${withdrawal.id}/dispense`);
      onDispensed();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Confirm Dispense"
      subtitle="Hand over the cash to the student, then confirm below"
      icon={<Banknote className="h-5 w-5" />}
      tone="success"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <PersonCell name={withdrawal.student.fullName} email={withdrawal.student.email} />
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-500">Amount</span>
            <span className="text-lg font-bold text-emerald-600">{formatMoney(withdrawal.amount)}</span>
          </div>
          {withdrawal.reason && (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Reason: </span>
              {withdrawal.reason}
            </p>
          )}
        </div>

        <p className="text-xs text-slate-400">
          No receipt is required for a savings withdrawal — this only confirms the cash was handed over.
        </p>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
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
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {isSubmitting ? 'Confirming…' : 'Confirm Dispense'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SavingsWithdrawals() {
  const [rows, setRows] = useState<AgentSavingsWithdrawalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [dispenseTarget, setDispenseTarget] = useState<AgentSavingsWithdrawalRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<AgentSavingsWithdrawalRow[]>>('/agent/savings-withdrawals');
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

  useSocketRefetch(load);

  const pendingRows = useMemo(() => rows.filter((row) => !row.dispensedAt), [rows]);
  const dispensedRows = useMemo(() => rows.filter((row) => row.dispensedAt), [rows]);

  const dispensedToday = useMemo(
    () => dispensedRows.filter((row) => row.dispensedAt && isToday(row.dispensedAt)).length,
    [dispensedRows]
  );
  const dispensedThisMonth = useMemo(
    () => dispensedRows.filter((row) => row.dispensedAt && isThisMonth(row.dispensedAt)).length,
    [dispensedRows]
  );

  const tabRows = tab === 'pending' ? pendingRows : tab === 'dispensed' ? dispensedRows : rows;

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tabRows;
    return tabRows.filter(
      (row) =>
        row.student.fullName.toLowerCase().includes(query) ||
        row.student.email.toLowerCase().includes(query)
    );
  }, [tabRows, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings Withdrawals"
        subtitle="Approved savings withdrawal requests ready to dispense"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Pending Dispense" value={String(pendingRows.length)} />
        <StatTile label="Dispensed Today" value={String(dispensedToday)} />
        <StatTile label="Dispensed This Month" value={String(dispensedThisMonth)} />
      </div>

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search by student name or email…" />
      </div>

      <TableCard
        title="Withdrawals"
        subtitle={`${visibleRows.length} shown`}
        actions={<FilterTabs tabs={TABS} value={tab} onChange={setTab} />}
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>Amount</th>
              <th className={TABLE_TH_CLASS}>Approved Date</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!isLoading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<PiggyBank className="h-8 w-8" />}
                    title="No approved savings withdrawals pending"
                    message="Approved requests waiting to be dispensed will show up here."
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              visibleRows.map((row, index) => (
                <tr key={row.id} className={tableRowClass(index)}>
                  <td className={TABLE_TD_CLASS}>
                    <PersonCell name={row.student.fullName} email={row.student.email} />
                  </td>
                  <td className={`${TABLE_TD_CLASS} font-bold text-emerald-600`}>{formatMoney(row.amount)}</td>
                  <td className={`${TABLE_TD_CLASS} text-slate-500`}>
                    {formatDateTime(row.approvedAt ?? row.requestedAt)}
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    {row.dispensedAt ? (
                      <DotBadge tone="green">Dispensed</DotBadge>
                    ) : (
                      <DotBadge tone="yellow">Ready to Dispense</DotBadge>
                    )}
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    {row.dispensedAt ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDispenseTarget(row)}
                        className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-primary-600"
                      >
                        Dispense Cash
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {isLoading && rows.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Loading savings withdrawals…</p>
        )}
      </TableCard>

      {dispenseTarget && (
        <DispenseConfirmModal
          withdrawal={dispenseTarget}
          onClose={() => setDispenseTarget(null)}
          onDispensed={() => {
            setDispenseTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
