import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ApiResponse, TransactionCategory, TransactionStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { categoryTone } from '../lib/badgeTones';
import { formatDateTime, formatMoney } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import { transactionStatusMeta, TRANSACTION_STATUS_LABELS } from '../lib/transactionStatus';
import { bucketTransaction } from '../lib/transactionKind';
import type { TransactionKind } from '../lib/transactionKind';
import { TRANSACTION_CATEGORIES, TRANSACTION_STATUSES } from '../types/admin';
import type { TransactionRow } from '../types/admin';

const MAX_PAGES = 5;
const FETCH_LIMIT = 100;
const PAGE_SIZE = 20;

const TABS: { kind: TransactionKind; label: string }[] = [
  { kind: 'P2P', label: 'P2P Transfers' },
  { kind: 'CARD_PAYMENT', label: 'Card Payments' },
  { kind: 'FUNDING', label: 'Funding' },
  { kind: 'WITHDRAWAL', label: 'Cash Withdrawals' },
];

const selectClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

function partyLabel(tx: TransactionRow): string {
  if (tx.fromWallet) return tx.fromWallet.user.fullName;
  if (tx.note === 'Admin added funds' || tx.note === 'Wallet top-up') return 'Admin (Top-up)';
  return '—';
}

function PartyCell({ name }: { name: string }) {
  if (name === '—') return <span className="text-slate-300">—</span>;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} size="sm" />
      <span className="font-medium text-slate-800">{name}</span>
    </div>
  );
}

export function Transactions() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [activeTab, setActiveTab] = useState<TransactionKind>('P2P');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TransactionStatus | 'PENDING_PARENT_APPROVAL' | 'ALL'>('ALL');
  const [category, setCategory] = useState<TransactionCategory | 'ALL'>('ALL');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        limit: FETCH_LIMIT,
        ...(status !== 'ALL' ? { status } : {}),
        ...(category !== 'ALL' ? { category } : {}),
        ...(flaggedOnly ? { flagged: 'true' } : {}),
      };
      const first = await api.get<ApiResponse<{ transactions: TransactionRow[]; total: number }>>(
        '/admin/transactions',
        { params: { ...params, page: 1 } }
      );
      const firstData = unwrap(first.data);
      const totalPages = Math.min(MAX_PAGES, Math.ceil(firstData.total / FETCH_LIMIT));

      const rest = await Promise.all(
        Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
          api
            .get<ApiResponse<{ transactions: TransactionRow[] }>>('/admin/transactions', {
              params: { ...params, page: index + 2 },
            })
            .then((res) => unwrap(res.data).transactions)
        )
      );

      setTransactions([...firstData.transactions, ...rest.flat()]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [status, category, flaggedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(load);
  useSocketRefetch(load);

  useEffect(() => {
    setPage(1);
  }, [activeTab, dateFrom, dateTo]);

  const bucketed = useMemo(
    () =>
      transactions.filter((tx) => {
        if (bucketTransaction(tx) !== activeTab) return false;
        if (dateFrom && tx.createdAt < dateFrom) return false;
        if (dateTo && tx.createdAt.slice(0, 10) > dateTo) return false;
        return true;
      }),
    [transactions, activeTab, dateFrom, dateTo]
  );

  const totalPages = Math.max(1, Math.ceil(bucketed.length / PAGE_SIZE));
  const pageRows = bucketed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabCounts = useMemo(() => {
    const counts: Record<TransactionKind, number> = { P2P: 0, CARD_PAYMENT: 0, FUNDING: 0, WITHDRAWAL: 0 };
    for (const tx of transactions) counts[bucketTransaction(tx)] += 1;
    return counts;
  }, [transactions]);

  const columnCount = activeTab === 'WITHDRAWAL' ? 5 : 6;

  return (
    <div className="space-y-4">
      <PageHeader title="Transactions" subtitle="All transactions across the platform, grouped by type" />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              onClick={() => setActiveTab(tab.kind)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.kind
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-slate-400">({tabCounts[tab.kind]})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TransactionStatus | 'PENDING_PARENT_APPROVAL' | 'ALL');
                setPage(1);
              }}
              className={selectClass}
            >
              <option value="ALL">All statuses</option>
              {TRANSACTION_STATUSES.filter((s) => s !== 'EMERGENCY' && s !== 'PENDING').map((s) => (
                <option key={s} value={s}>
                  {TRANSACTION_STATUS_LABELS[s] ?? humanizeEnum(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category-filter" className="mb-1 block text-xs font-medium text-slate-600">
              Category
            </label>
            <select
              id="category-filter"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as TransactionCategory | 'ALL');
                setPage(1);
              }}
              className={selectClass}
            >
              <option value="ALL">All categories</option>
              {TRANSACTION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanizeEnum(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="date-from" className="mb-1 block text-xs font-medium text-slate-600">
              From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className={selectClass}
            />
          </div>

          <div>
            <label htmlFor="date-to" className="mb-1 block text-xs font-medium text-slate-600">
              To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className={selectClass}
            />
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(event) => {
                setFlaggedOnly(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Flagged only
          </label>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title={TABS.find((t) => t.kind === activeTab)?.label ?? 'Transactions'} subtitle={`${bucketed.length} shown`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              {activeTab === 'P2P' && (
                <>
                  <th className={TABLE_TH_CLASS}>Sender</th>
                  <th className={TABLE_TH_CLASS}>Receiver</th>
                </>
              )}
              {activeTab === 'CARD_PAYMENT' && (
                <>
                  <th className={TABLE_TH_CLASS}>Payer</th>
                  <th className={TABLE_TH_CLASS}>Merchant</th>
                </>
              )}
              {activeTab === 'FUNDING' && (
                <>
                  <th className={TABLE_TH_CLASS}>Source</th>
                  <th className={TABLE_TH_CLASS}>Recipient</th>
                </>
              )}
              {activeTab === 'WITHDRAWAL' && <th className={TABLE_TH_CLASS}>Student</th>}
              <th className={TABLE_TH_CLASS}>Amount</th>
              <th className={TABLE_TH_CLASS}>Category</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Date</th>
              {activeTab !== 'WITHDRAWAL' && <th className={TABLE_TH_CLASS}>Fraud</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={columnCount} avatarColumn={false} />}
            {!isLoading && pageRows.length === 0 && (
              <tr>
                <td colSpan={columnCount}>
                  <EmptyState
                    icon={<ArrowLeftRight className="h-8 w-8" />}
                    title="No transactions found"
                    message="Try adjusting the filters or date range above."
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              pageRows.map((tx, index) => {
                const statusMeta = transactionStatusMeta(tx);
                const senderName = partyLabel(tx);
                const receiverName = tx.toWallet?.user.fullName ?? tx.receiverName ?? '—';
                return (
                  <tr key={tx.id} className={tableRowClass(index)}>
                    {activeTab === 'WITHDRAWAL' ? (
                      <td className={TABLE_TD_CLASS}>
                        <PartyCell name={senderName} />
                      </td>
                    ) : (
                      <>
                        <td className={TABLE_TD_CLASS}>
                          <PartyCell name={senderName} />
                        </td>
                        <td className={TABLE_TD_CLASS}>
                          <PartyCell name={receiverName} />
                        </td>
                      </>
                    )}
                    <td className={`${TABLE_TD_CLASS} font-semibold text-slate-900`}>
                      {formatMoney(tx.amount, tx.currency)}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <Badge tone={categoryTone[tx.category] ?? 'gray'}>{humanizeEnum(tx.category)}</Badge>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <DotBadge tone={statusMeta.tone}>{statusMeta.label}</DotBadge>
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDateTime(tx.createdAt)}</td>
                    {activeTab !== 'WITHDRAWAL' && (
                      <td className={TABLE_TD_CLASS}>
                        {tx.fraudAlerts.length > 0 ? (
                          <DotBadge tone="red">Flagged</DotBadge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </TableCard>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} ({bucketed.length} transactions)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
