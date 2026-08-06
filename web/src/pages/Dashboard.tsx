import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { transactionStatusTone, severityTone } from '../lib/badgeTones';
import { formatDate, formatMoney } from '../lib/format';
import type { FraudAlertRow, SystemStats, TransactionRow } from '../types/admin';

type RolloverResult = {
  month: string;
  processed: Array<{ walletId: string; userId: string; amountSaved: string }>;
};

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, (monthNum ?? 1) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function RolloverConfirmModal({
  onClose,
  onConfirmed,
}: {
  onClose: () => void;
  onConfirmed: (result: RolloverResult) => void;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await api.post<ApiResponse<RolloverResult>>('/savings/rollover');
      onConfirmed(unwrap(res.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal title="Trigger Monthly Rollover" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Are you sure you want to trigger the monthly rollover for all students?
        </p>
        <p className="text-xs text-slate-400">
          This sweeps every student&apos;s unspent budget for the current month into their
          Personal Savings and archives the month&apos;s budget categories. This is the same job
          that runs automatically at midnight on the last day of every month.
        </p>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRunning}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {isRunning ? 'Running…' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SystemActionsCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState<RolloverResult | null>(null);

  const totalSaved = result?.processed.reduce((sum, entry) => sum + Number(entry.amountSaved), 0) ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">System Actions</h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Personal Savings — Monthly Rollover</p>
          <p className="mt-1 text-sm text-slate-500">
            Normally runs automatically at midnight on the last day of every month. Trigger it
            manually here for demo or testing purposes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setModalOpen(true);
          }}
          className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
        >
          Trigger Monthly Rollover
        </button>
      </div>

      {result && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Rollover complete for {formatMonthLabel(result.month)} — {result.processed.length}{' '}
          student{result.processed.length === 1 ? '' : 's'} saved a total of ${totalSaved.toFixed(2)}.
        </p>
      )}

      {modalOpen && (
        <RolloverConfirmModal
          onClose={() => setModalOpen(false)}
          onConfirmed={(res) => {
            setResult(res);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, txRes, alertsRes] = await Promise.all([
        api.get<ApiResponse<SystemStats>>('/admin/stats'),
        api.get<ApiResponse<{ transactions: TransactionRow[] }>>('/admin/transactions', {
          params: { limit: 10 },
        }),
        api.get<ApiResponse<FraudAlertRow[]>>('/admin/fraud-alerts', {
          params: { resolved: 'false' },
        }),
      ]);
      setStats(unwrap(statsRes.data));
      setTransactions(unwrap(txRes.data).transactions);
      setAlerts(unwrap(alertsRes.data).slice(0, 5));
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

  if (isLoading && !stats) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  if (error && !stats) {
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!stats) {
    return null;
  }

  const chartData = Object.entries(stats.transactions.byStatus).map(([status, count]) => ({
    status,
    count,
  }));

  const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  const adminCount = stats.users.byType.ADMIN ?? 0;
  const usersSubtitle = [
    pluralize(stats.users.studentCount, 'student'),
    pluralize(stats.users.parentCount, 'parent'),
    pluralize(stats.users.institutionCount, 'institution'),
    pluralize(adminCount, 'admin'),
  ].join(', ');

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Overview</h1>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.users.total} subtitle={usersSubtitle} />
        <StatCard label="Total Transactions" value={stats.transactions.total} />
        <StatCard label="Active Fraud Alerts" value={stats.fraudAlerts.active} accent="red" />
        <StatCard
          label="Pending KYC"
          value={stats.kyc.pending}
          subtitle="Students awaiting review"
          accent="yellow"
        />
        <StatCard label="Total Withdrawals" value={stats.withdrawals.totalCompleted} />
        <StatCard
          label="Pending Report Requests"
          value={stats.reportRequests.pending}
          accent="yellow"
        />
        <StatCard
          label="Pending Email Change Requests"
          value={stats.emailChangeRequests.pending}
          accent="yellow"
        />
        <StatCard
          label="Total Personal Savings"
          value={formatMoney(stats.personalSavings.totalBalance, 'USD')}
        />
        <StatCard
          label="Scholarships Disbursed This Month"
          value={formatMoney(stats.scholarships.totalThisMonth, 'USD')}
          accent="green"
        />
      </div>

      <SystemActionsCard />

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Transactions by Status</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2E5FAC" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
            Recent Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2">{formatMoney(tx.amount, tx.currency)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={transactionStatusTone[tx.status] ?? 'gray'}>{tx.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{formatDate(tx.createdAt)}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
            Recent Fraud Alerts
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Severity</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="px-4 py-2">{alert.alertType}</td>
                    <td className="px-4 py-2">
                      <Badge tone={severityTone[alert.severity] ?? 'gray'}>{alert.severity}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{formatDate(alert.createdAt)}</td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      No active fraud alerts
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
