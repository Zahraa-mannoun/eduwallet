import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { formatMoney } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { categoryColor } from '../lib/categoryColors';
import { TRANSACTION_STATUS_LABELS } from '../lib/transactionStatus';
import type { AnalyticsResult, SystemStats } from '../types/admin';

const FRAUD_TYPE_COLORS: Record<string, string> = {
  CIRCULAR: '#7C3AED',
  VELOCITY: '#F59E0B',
  DUPLICATE: '#0EA5E9',
  UNUSUAL_AMOUNT: '#DC2626',
};

// Auto-Approved green, Approved blue, Rejected red, Awaiting Parent Approval amber (per spec) —
// the rest get a reasonable fallback color so any status the API returns still renders.
const TRANSACTION_STATUS_COLORS: Record<string, string> = {
  AUTO_APPROVED: '#10B981',
  APPROVED: '#2E5FAC',
  REJECTED: '#DC2626',
  PENDING_PARENT_APPROVAL: '#F59E0B',
  EMERGENCY: '#F97316',
  PENDING: '#94A3B8',
  COMPLETED: '#059669',
};

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

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-4 h-72 w-full">{children}</div>
    </div>
  );
}

const categoryTick = (category: string) => humanizeEnum(category);

export function Analytics() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [analyticsRes, statsRes] = await Promise.all([
        api.get<ApiResponse<AnalyticsResult>>('/admin/analytics'),
        api.get<ApiResponse<SystemStats>>('/admin/stats'),
      ]);
      setData(unwrap(analyticsRes.data));
      setStats(unwrap(statsRes.data));
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

  if (isLoading && !data) {
    return <p className="text-sm text-slate-500">Loading analytics…</p>;
  }

  if (error && !data) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
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

  const transactionStatusData = stats
    ? Object.entries(stats.transactions.byStatus).map(([status, count]) => ({
        status,
        label: TRANSACTION_STATUS_LABELS[status] ?? humanizeEnum(status),
        count,
      }))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-0.5 text-sm text-slate-500">Platform-wide spending, funding, and fraud trends</p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      <Section title="Spending Analytics">
        <p className="text-sm text-slate-500">
          Funding is money moving INTO a student's wallet from a parent or institution (locked
          transfers, scholarships) — it&apos;s not spending until the student actually uses it.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Funding Received per Category" subtitle="This month">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.funding.byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="category"
                  tickFormatter={categoryTick}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatMoney(value, 'USD')}
                  labelFormatter={categoryTick}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Funding Received">
                  {data.funding.byCategory.map((entry) => (
                    <Cell key={entry.category} fill={categoryColor(entry.category)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Spending per Category" subtitle="This month">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.spending.byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="category"
                  tickFormatter={categoryTick}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatMoney(value, 'USD')}
                  labelFormatter={categoryTick}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Spending">
                  {data.spending.byCategory.map((entry) => (
                    <Cell key={entry.category} fill={categoryColor(entry.category)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Transaction Volume" subtitle="Last 30 days">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyVolumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatMoney(value, 'USD')} />
                <Line type="monotone" dataKey="total" stroke="#2E5FAC" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Transactions by Status" subtitle="Breakdown of all transactions by current status">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transactionStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={55} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13 }} cursor={{ fill: '#EFF6FF' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {transactionStatusData.map((entry) => (
                    <Cell key={entry.status} fill={TRANSACTION_STATUS_COLORS[entry.status] ?? '#2E5FAC'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      <Section title="Withdrawal Analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Total Withdrawals This Month"
            value={formatMoney(data.withdrawals.totalThisMonth, 'USD')}
            accent="teal"
          />
          <StatCard
            label="Receipt Verification Success Rate"
            value={formatPercent(data.withdrawals.verificationSuccessRate)}
            subtitle="Auto-verified / total with receipts"
            accent="green"
            emphasizeValue
          />
        </div>
        <ChartCard title="Total Withdrawals per Category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.withdrawals.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="category"
                tickFormatter={categoryTick}
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => formatMoney(value, 'USD')}
                labelFormatter={categoryTick}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {data.withdrawals.byCategory.map((entry) => (
                  <Cell key={entry.category} fill={categoryColor(entry.category)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Scholarship Analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Institutions" value={data.scholarships.totalInstitutions} accent="blue" />
          <StatCard
            label="Total Disbursed (All Time)"
            value={formatMoney(data.scholarships.totalAllTime, 'USD')}
            accent="indigo"
          />
          <StatCard
            label="Fully Funded Students"
            value={data.scholarships.fullCount}
            accent="green"
            emphasizeValue
          />
          <StatCard
            label="Partially Funded Students"
            value={data.scholarships.partialCount}
            accent="yellow"
            emphasizeValue
          />
        </div>
        <ChartCard title="Total Disbursed per Category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.scholarships.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="category"
                tickFormatter={categoryTick}
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => formatMoney(value, 'USD')}
                labelFormatter={categoryTick}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {data.scholarships.byCategory.map((entry) => (
                  <Cell key={entry.category} fill={categoryColor(entry.category)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      <Section title="Savings Analytics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Savings (All Students)"
            value={formatMoney(data.savings.totalBalance, 'USD')}
            accent="teal"
          />
          <StatCard
            label="Average Savings per Student"
            value={formatMoney(data.savings.averagePerStudent, 'USD')}
            accent="blue"
          />
          <StatCard
            label="Pending Withdrawal Requests"
            value={data.savings.pendingWithdrawals}
            accent="yellow"
            emphasizeValue={data.savings.pendingWithdrawals > 0}
          />
        </div>
        <ChartCard title="Personal Savings Balance Trend" subtitle="Monthly rollovers">
          {savingsTrendData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No rollover history yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
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
          <StatCard label="Total Alerts" value={data.fraud.total} accent="indigo" />
          <StatCard label="Resolved" value={data.fraud.resolved} accent="green" emphasizeValue />
          <StatCard label="Resolution Rate" value={formatPercent(data.fraud.resolutionRate)} accent="blue" />
          <StatCard
            label="Most Common Type"
            value={data.fraud.mostCommon ? humanizeEnum(data.fraud.mostCommon) : '—'}
            accent="red"
            emphasizeValue={data.fraud.mostCommon !== null}
          />
        </div>
        <ChartCard title="Fraud Alerts by Type">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.fraud.byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="type" tickFormatter={humanizeEnum} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={humanizeEnum} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.fraud.byType.map((entry) => (
                  <Cell key={entry.type} fill={FRAUD_TYPE_COLORS[entry.type] ?? '#64748B'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>
    </div>
  );
}
