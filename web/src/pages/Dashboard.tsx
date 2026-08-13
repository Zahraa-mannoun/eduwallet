import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { EmptyState } from '../components/EmptyState';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { severityTone } from '../lib/badgeTones';
import { formatDate, formatMoney } from '../lib/format';
import { transactionStatusMeta, TRANSACTION_STATUS_LABELS } from '../lib/transactionStatus';
import { humanizeEnum } from '../lib/humanize';
import type { AnalyticsResult, FraudAlertRow, SystemStats, TransactionRow } from '../types/admin';

type RolloverResult = {
  month: string;
  processed: Array<{ walletId: string; userId: string; amountSaved: string }>;
};

const STATUS_COLORS: Record<string, string> = {
  AUTO_APPROVED: '#10B981',
  APPROVED: '#2E5FAC',
  REJECTED: '#DC2626',
  EMERGENCY: '#F97316',
  PENDING_PARENT_APPROVAL: '#F59E0B',
  PENDING: '#94A3B8',
  COMPLETED: '#059669',
};

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, (monthNum ?? 1) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function formatShortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${month}/${day}`;
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

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRunning}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">System Actions</h2>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Personal Savings — Monthly Rollover</p>
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
          className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Trigger Monthly Rollover
        </button>
      </div>

      {result && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
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
  const [dailyVolume, setDailyVolume] = useState<AnalyticsResult['spending']['dailyVolume']>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, txRes, alertsRes, analyticsRes] = await Promise.all([
        api.get<ApiResponse<SystemStats>>('/admin/stats'),
        api.get<ApiResponse<{ transactions: TransactionRow[] }>>('/admin/transactions', {
          params: { limit: 10 },
        }),
        api.get<ApiResponse<FraudAlertRow[]>>('/admin/fraud-alerts', {
          params: { resolved: 'false' },
        }),
        api.get<ApiResponse<AnalyticsResult>>('/admin/analytics'),
      ]);
      setStats(unwrap(statsRes.data));
      setTransactions(unwrap(txRes.data).transactions);
      setAlerts(unwrap(alertsRes.data).slice(0, 5));
      setDailyVolume(unwrap(analyticsRes.data).spending.dailyVolume);
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

  if (isLoading && !stats) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  if (error && !stats) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!stats) {
    return null;
  }

  const chartData = Object.entries(stats.transactions.byStatus).map(([status, count]) => ({
    status,
    label: TRANSACTION_STATUS_LABELS[status] ?? humanizeEnum(status),
    count,
  }));

  const volumeData = dailyVolume.map((row) => ({ ...row, label: formatShortDate(row.date) }));

  const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  const usersSubtitle = [
    pluralize(stats.users.studentCount, 'student'),
    pluralize(stats.users.parentCount, 'parent'),
    pluralize(stats.users.institutionCount, 'institution'),
  ].join(' · ');

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">{today}</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.users.total} subtitle={usersSubtitle} accent="blue" />
        <StatCard label="Total Transactions" value={stats.transactions.total} accent="indigo" />
        <StatCard
          label="Active Fraud Alerts"
          value={stats.fraudAlerts.active}
          accent="red"
          emphasizeValue={stats.fraudAlerts.active > 0}
        />
        <StatCard
          label="Pending KYC"
          value={stats.kyc.pending}
          subtitle="Students awaiting review"
          accent="orange"
          emphasizeValue={stats.kyc.pending > 0}
        />
        <StatCard label="Total Withdrawals" value={stats.withdrawals.totalCompleted} accent="teal" />
        <StatCard label="Withdrawals Today" value={stats.withdrawals.today} accent="teal" />
        <StatCard label="Pending Reports" value={stats.reportRequests.pending} accent="purple" />
        <StatCard
          label="Scholarships This Month"
          value={formatMoney(stats.scholarships.totalThisMonth, 'USD')}
          accent="green"
        />

        <StatCard label="Active Agents" value={stats.agents.active} accent="slate" />
        <StatCard
          label="Suspended Agents"
          value={stats.agents.suspended}
          accent="red"
          emphasizeValue={stats.agents.suspended > 0}
        />
        <StatCard
          label="Pending Agent Messages"
          value={stats.agentMessages.pending}
          accent="yellow"
          emphasizeValue={stats.agentMessages.pending > 0}
        />
        <StatCard
          label="Pending Email Change Requests"
          value={stats.emailChangeRequests.pending}
          accent="yellow"
          emphasizeValue={stats.emailChangeRequests.pending > 0}
        />
        <StatCard
          label="Total Personal Savings"
          value={formatMoney(stats.personalSavings.totalBalance, 'USD')}
          accent="slate"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Transactions by Status</h2>
          <p className="text-xs text-slate-400">Breakdown of all transactions by current status</p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={55} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#2E5FAC'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Transaction Volume — Last 30 Days</h2>
          <p className="text-xs text-slate-400">Total spending volume per day</p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E5FAC" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2E5FAC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#2E5FAC"
                  strokeWidth={2}
                  fill="url(#volumeFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
            Recent Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Sender</th>
                  <th className="px-4 py-2.5 text-left">Receiver</th>
                  <th className="px-4 py-2.5 text-left">Amount</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const statusMeta = transactionStatusMeta(tx);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-600">
                        {tx.fromWallet
                          ? tx.fromWallet.user.fullName
                          : tx.note === 'Admin added funds' || tx.note === 'Wallet top-up'
                            ? 'Admin'
                            : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {tx.toWallet?.user.fullName ?? tx.receiverName ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {formatMoney(tx.amount, tx.currency)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{humanizeEnum(tx.category)}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{formatDate(tx.createdAt)}</td>
                    </tr>
                  );
                })}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No transactions yet" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
            Recent Fraud Alerts
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-700">{humanizeEnum(alert.alertType)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={severityTone[alert.severity] ?? 'gray'}>
                        {humanizeEnum(alert.severity)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(alert.createdAt)}</td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState title="No active fraud alerts" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SystemActionsCard />
    </div>
  );
}
