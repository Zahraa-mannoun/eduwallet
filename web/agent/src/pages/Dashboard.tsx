import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Flag, ShieldCheck } from 'lucide-react';
import type { ApiResponse, AgentStats, WithdrawalRequest, WithdrawalStatus } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { AgentStatsCard } from '../components/AgentStatsCard';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatRelativeTime } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { withdrawalStatusTone } from '../lib/badgeTones';
import { useSocketRefetch } from '../hooks/useSocketRefetch';

const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING: 'Pending',
  PENDING_PARENT_APPROVAL: 'Awaiting Parent Approval',
  APPROVED: 'Approved — Awaiting Dispense',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
};

export function Dashboard() {
  const { agent } = useAuth();
  const navigate = useNavigate();

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [withdrawalsRes, statsRes] = await Promise.all([
        api.get<ApiResponse<WithdrawalRequest[]>>('/withdrawals'),
        api.get<ApiResponse<AgentStats>>('/agent/stats'),
      ]);
      setWithdrawals(unwrap(withdrawalsRes.data));
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

  useSocketRefetch(load);

  const pendingApprovalCount = withdrawals.filter(
    (request) => request.status === 'PENDING_PARENT_APPROVAL' || request.status === 'APPROVED'
  ).length;

  const flaggedCount = withdrawals.filter(
    (request) => request.receiptPath && request.receiptVerificationStatus === 'FLAGGED'
  ).length;

  const recent = [...withdrawals]
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 via-primary to-[#4a7fd4] p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-primary-100">Welcome back</p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-bold">{agent?.fullName ?? 'Agent'}</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
            <ShieldCheck className="h-3 w-3" />
            Agent
          </span>
        </div>
        <p className="mt-1 text-sm text-primary-100">Here&apos;s your activity overview.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <AgentStatsCard />

      {pendingApprovalCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="h-[18px] w-[18px]" />
            </div>
            <p className="text-sm font-semibold text-amber-800">
              {pendingApprovalCount} withdrawal{pendingApprovalCount === 1 ? '' : 's'} awaiting parent approval
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="text-sm font-semibold text-amber-700 hover:underline"
          >
            View in History →
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle className="h-[18px] w-[18px]" />
          </div>
          <p className="text-sm font-semibold text-emerald-800">All caught up — no withdrawals awaiting approval.</p>
        </div>
      )}

      {flaggedCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <Flag className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {flaggedCount} receipt{flaggedCount === 1 ? '' : 's'} flagged for review
            </p>
            <p className="text-xs text-red-600">These will be reviewed by admin.</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
            <p className="text-sm text-slate-500">Your last 5 withdrawals</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="text-sm font-semibold text-primary hover:underline"
          >
            View all →
          </button>
        </div>

        {!isLoading && recent.length === 0 ? (
          <EmptyState title="No withdrawals processed yet" message="Withdrawals you dispense will show up here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((request) => (
              <div key={request.id} className="flex items-center gap-3 px-6 py-4">
                <Avatar name={request.wallet.user.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{request.wallet.user.fullName}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{formatRelativeTime(request.completedAt ?? request.createdAt)}</p>
                </div>
                <Badge tone="blue">{humanizeEnum(request.category)}</Badge>
                <p className="w-20 shrink-0 text-right font-semibold text-slate-900">{formatMoney(request.amount)}</p>
                <DotBadge tone={withdrawalStatusTone[request.status] ?? 'gray'}>
                  {STATUS_LABELS[request.status]}
                </DotBadge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">This Month&apos;s Performance</h2>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;ve dispensed{' '}
          <span className="font-bold text-primary">${stats?.totalDispensedThisMonth ?? '0.00'}</span> across{' '}
          <span className="font-bold text-primary">{stats?.withdrawalsThisMonth ?? 0}</span> withdrawal
          {stats?.withdrawalsThisMonth === 1 ? '' : 's'} this month.
        </p>
      </div>
    </div>
  );
}
