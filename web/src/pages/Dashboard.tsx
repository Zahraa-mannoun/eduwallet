import { useEffect, useState } from 'react';
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
import { transactionStatusTone, severityTone } from '../lib/badgeTones';
import { formatDate, formatMoney } from '../lib/format';
import type { FraudAlertRow, SystemStats, TransactionRow } from '../types/admin';

export function Dashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
    }
    void load();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  if (error) {
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!stats) {
    return null;
  }

  const chartData = Object.entries(stats.transactions.byStatus).map(([status, count]) => ({
    status,
    count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.users.total} />
        <StatCard label="Total Transactions" value={stats.transactions.total} />
        <StatCard label="Active Fraud Alerts" value={stats.fraudAlerts.active} accent="red" />
        <StatCard label="Pending KYC" value={stats.kyc.pending} accent="yellow" />
      </div>

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
