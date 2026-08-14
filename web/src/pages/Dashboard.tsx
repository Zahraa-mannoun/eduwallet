import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarClock,
  FileText,
  GraduationCap,
  Mail,
  MessageSquare,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
  UserX,
  Users,
  Wallet,
} from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { DOT_COLOR } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { formatMoney, formatRelativeTime } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { transactionStatusMeta } from '../lib/transactionStatus';
import { bucketTransaction } from '../lib/transactionKind';
import type { SupportMessageRow, SystemStats, TransactionRow } from '../types/admin';

// Turns a raw transaction row into a one-line activity feed entry — description text plus the
// status-derived tone that drives the leading dot color. Reuses bucketTransaction/
// transactionStatusMeta (the same classification Transactions.tsx and Dashboard's old status
// chart used) instead of re-deriving transaction "kind" from scratch.
function activityDescription(tx: TransactionRow): { text: string; tone: ReturnType<typeof transactionStatusMeta>['tone'] } {
  const kind = bucketTransaction(tx);
  const statusMeta = transactionStatusMeta(tx);
  const amount = formatMoney(tx.amount, tx.currency);
  const categoryLabel = humanizeEnum(tx.category);
  const senderName =
    tx.fromWallet?.user.fullName ??
    (tx.note === 'Admin added funds' || tx.note === 'Wallet top-up' ? 'Admin' : 'Someone');
  const receiverName = tx.toWallet?.user.fullName ?? tx.receiverName ?? 'someone';

  if (kind === 'WITHDRAWAL') {
    return { text: `${senderName} withdrew ${amount} · ${categoryLabel}`, tone: statusMeta.tone };
  }
  if (kind === 'FUNDING') {
    const verb = tx.fromWallet?.user.userType === 'INSTITUTION' ? 'disbursed' : 'sent';
    return { text: `${senderName} ${verb} ${amount} to ${receiverName} · ${categoryLabel}`, tone: statusMeta.tone };
  }
  if (kind === 'CARD_PAYMENT') {
    return { text: `${senderName} spent ${amount} at ${receiverName}`, tone: statusMeta.tone };
  }
  return { text: `${senderName} sent ${amount} to ${receiverName} · ${statusMeta.label}`, tone: statusMeta.tone };
}

function NeedsAttentionCard({
  count,
  label,
  description,
  onReview,
}: {
  count: number;
  label: string;
  description: string;
  onReview: () => void;
}) {
  const needsAttention = count > 0;
  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${
        needsAttention ? 'border-l-red-400' : 'border-l-emerald-400'
      }`}
    >
      <p className={`text-3xl font-bold ${needsAttention ? 'text-slate-900' : 'text-slate-400'}`}>{count}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      <button
        type="button"
        onClick={onReview}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        Review Now
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [pendingSupportCount, setPendingSupportCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, txRes, supportRes] = await Promise.all([
        api.get<ApiResponse<SystemStats>>('/admin/stats'),
        api.get<ApiResponse<{ transactions: TransactionRow[] }>>('/admin/transactions', {
          params: { limit: 5 },
        }),
        api.get<ApiResponse<SupportMessageRow[]>>('/support/messages'),
      ]);
      setStats(unwrap(statsRes.data));
      setTransactions(unwrap(txRes.data).transactions);
      setPendingSupportCount(unwrap(supportRes.data).filter((m) => m.status === 'UNREAD').length);
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

  const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  const usersSubtitle = [
    pluralize(stats.users.studentCount, 'student'),
    pluralize(stats.users.parentCount, 'parent'),
    pluralize(stats.users.institutionCount, 'institution'),
    pluralize(stats.users.agentCount, 'agent'),
    pluralize(stats.users.adminCount, 'admin'),
  ].join(' · ');

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const activeUsersToday = new Set(
    transactions
      .filter((tx) => tx.createdAt.slice(0, 10) === todayKey)
      .flatMap((tx) => [tx.fromWallet?.user.id, tx.toWallet?.user.id])
      .filter((id): id is string => Boolean(id))
  ).size;

  const totalBalance = Object.values(stats.wallets.balanceByCurrency).reduce((sum, v) => sum + v, 0);

  const iconClass = 'h-5 w-5';

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={today} />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats.users.total}
          subtitle={usersSubtitle}
          accent="blue"
          icon={<Users className={iconClass} />}
        />
        <StatCard
          label="Total Transactions"
          value={stats.transactions.total}
          accent="indigo"
          icon={<Banknote className={iconClass} />}
        />
        <StatCard
          label="Active Fraud Alerts"
          value={stats.fraudAlerts.active}
          accent="red"
          emphasizeValue={stats.fraudAlerts.active > 0}
          icon={<ShieldAlert className={iconClass} />}
        />
        <StatCard
          label="Pending KYC"
          value={stats.kyc.pending}
          subtitle="Students awaiting review"
          accent="orange"
          emphasizeValue={stats.kyc.pending > 0}
          icon={<ShieldCheck className={iconClass} />}
        />
        <StatCard
          label="Total Withdrawals"
          value={stats.withdrawals.totalCompleted}
          accent="teal"
          icon={<Wallet className={iconClass} />}
        />
        <StatCard
          label="Withdrawals Today"
          value={stats.withdrawals.today}
          accent="teal"
          icon={<CalendarClock className={iconClass} />}
        />
        <StatCard
          label="Pending Reports"
          value={stats.reportRequests.pending}
          accent="purple"
          icon={<FileText className={iconClass} />}
        />
        <StatCard
          label="Scholarships This Month"
          value={formatMoney(stats.scholarships.totalThisMonth, 'USD')}
          accent="green"
          icon={<GraduationCap className={iconClass} />}
        />

        <StatCard
          label="Active Agents"
          value={stats.agents.active}
          accent="slate"
          icon={<Briefcase className={iconClass} />}
        />
        <StatCard
          label="Suspended Agents"
          value={stats.agents.suspended}
          accent="red"
          emphasizeValue={stats.agents.suspended > 0}
          icon={<UserX className={iconClass} />}
        />
        <StatCard
          label="Pending Agent Messages"
          value={stats.agentMessages.pending}
          accent="yellow"
          emphasizeValue={stats.agentMessages.pending > 0}
          icon={<MessageSquare className={iconClass} />}
        />
        <StatCard
          label="Pending Email Change Requests"
          value={stats.emailChangeRequests.pending}
          accent="yellow"
          emphasizeValue={stats.emailChangeRequests.pending > 0}
          icon={<Mail className={iconClass} />}
        />
        <StatCard
          label="Total Personal Savings"
          value={formatMoney(stats.personalSavings.totalBalance, 'USD')}
          accent="slate"
          icon={<PiggyBank className={iconClass} />}
        />
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Needs Attention</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NeedsAttentionCard
            count={stats.kyc.pending}
            label="Pending KYC Reviews"
            description="Students awaiting document review"
            onReview={() => navigate('/kyc')}
          />
          <NeedsAttentionCard
            count={stats.fraudAlerts.active}
            label="Active Fraud Alerts"
            description="Suspicious transactions to review"
            onReview={() => navigate('/fraud')}
          />
          <NeedsAttentionCard
            count={stats.reportRequests.pending}
            label="Pending Reports"
            description="Parent report requests awaiting generation"
            onReview={() => navigate('/reports')}
          />
          <NeedsAttentionCard
            count={pendingSupportCount}
            label="Pending Support Messages"
            description="Unread messages from users"
            onReview={() => navigate('/support')}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
        <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
        <p className="text-xs text-slate-400">Latest system events</p>

        <div className="mt-4">
          {transactions.length === 0 ? (
            <EmptyState icon={<Banknote className="h-8 w-8" />} title="No recent activity" />
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const { text, tone } = activityDescription(tx);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[tone]}`} />
                    <p className="flex-1 truncate text-sm text-slate-700">{text}</p>
                    <p className="shrink-0 text-xs text-slate-400">{formatRelativeTime(tx.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-around">
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Active Users Today</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{activeUsersToday}</p>
          </div>
          <div className="hidden h-10 w-px bg-slate-200 sm:block" />
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Balance in System</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(totalBalance, 'USD')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
