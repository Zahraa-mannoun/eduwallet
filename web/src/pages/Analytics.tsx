import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatMoney } from '../lib/format';
import type { AnalyticsResult } from '../types/admin';

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatShortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${month}/${day}`;
}

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, (monthNum ?? 1) - 1, 1);
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<AnalyticsResult>>('/admin/analytics');
      setData(unwrap(response.data));
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

  if (isLoading && !data) {
    return <p className="text-sm text-slate-500">Loading analytics…</p>;
  }

  if (error && !data) {
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!data) {
    return null;
  }

  const dailyVolumeData = data.spending.dailyVolume.map((row) => ({
    ...row,
    label: formatShortDate(row.date),
  }));

  const savingsTrendData = data.savings.monthlyTrend.map((row) => ({
    ...row,
    label: formatMonthLabel(row.month),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Analytics</h1>
        {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      <Section title="Spending Analytics">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Total Spent per Category (This Month)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.spending.byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
                <Bar dataKey="total" fill="#2E5FAC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Transaction Volume — Last 30 Days">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyVolumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
                <Line type="monotone" dataKey="total" stroke="#2E5FAC" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Withdrawal Analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Total Withdrawals This Month" value={formatMoney(data.withdrawals.totalThisMonth, 'USD')} />
          <StatCard
            label="Receipt Verification Success Rate"
            value={formatPercent(data.withdrawals.verificationSuccessRate)}
            subtitle="Auto-verified / total with receipts"
            accent="green"
          />
        </div>
        <ChartCard title="Total Withdrawals per Category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.withdrawals.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
              <Bar dataKey="total" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Scholarship Analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Institutions" value={data.scholarships.totalInstitutions} />
          <StatCard label="Total Disbursed (All Time)" value={formatMoney(data.scholarships.totalAllTime, 'USD')} />
          <StatCard label="Fully Funded Students" value={data.scholarships.fullCount} accent="green" />
          <StatCard label="Partially Funded Students" value={data.scholarships.partialCount} accent="yellow" />
        </div>
        <ChartCard title="Total Disbursed per Category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.scholarships.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
              <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Savings Analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total Savings (All Students)" value={formatMoney(data.savings.totalBalance, 'USD')} />
          <StatCard label="Average Savings per Student" value={formatMoney(data.savings.averagePerStudent, 'USD')} />
          <StatCard label="Pending Withdrawal Requests" value={data.savings.pendingWithdrawals} accent="yellow" />
        </div>
        <ChartCard title="Personal Savings Balance Trend (Monthly Rollovers)">
          {savingsTrendData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No rollover history yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
                <Line type="monotone" dataKey="total" stroke="#2E5FAC" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </Section>

      <Section title="Fraud Analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Alerts" value={data.fraud.total} />
          <StatCard label="Resolved" value={data.fraud.resolved} accent="green" />
          <StatCard label="Resolution Rate" value={formatPercent(data.fraud.resolutionRate)} />
          <StatCard label="Most Common Type" value={data.fraud.mostCommon ?? '—'} accent="red" />
        </div>
        <ChartCard title="Fraud Alerts by Type">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.fraud.byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#DC2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>
    </div>
  );
}
