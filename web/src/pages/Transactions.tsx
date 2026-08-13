import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse, TransactionCategory, TransactionStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { categoryTone } from '../lib/badgeTones';
import { formatDateTime, formatMoney } from '../lib/format';
import { transactionStatusMeta, TRANSACTION_STATUS_LABELS } from '../lib/transactionStatus';
import { TRANSACTION_CATEGORIES, TRANSACTION_STATUSES } from '../types/admin';
import type { TransactionRow } from '../types/admin';

export function Transactions() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TransactionStatus | 'PENDING_PARENT_APPROVAL' | 'ALL'>('ALL');
  const [category, setCategory] = useState<TransactionCategory | 'ALL'>('ALL');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const limit = 20;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<
        ApiResponse<{ transactions: TransactionRow[]; total: number }>
      >('/admin/transactions', {
        params: {
          page,
          limit,
          ...(status !== 'ALL' ? { status } : {}),
          ...(category !== 'ALL' ? { category } : {}),
          ...(flaggedOnly ? { flagged: 'true' } : {}),
        },
      });
      const data = unwrap(response.data);
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, status, category, flaggedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(load);
  useSocketRefetch(load);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TransactionStatus | 'PENDING_PARENT_APPROVAL' | 'ALL');
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All statuses</option>
          {TRANSACTION_STATUSES.filter((s) => s !== 'EMERGENCY' && s !== 'PENDING').map((s) => (
            <option key={s} value={s}>
              {TRANSACTION_STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as TransactionCategory | 'ALL');
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All categories</option>
          {TRANSACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600">
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

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Sender</th>
              <th className="px-4 py-3 text-left">Receiver</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Fraud</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No transactions found
                </td>
              </tr>
            )}
            {!isLoading &&
              transactions.map((tx) => {
                const statusMeta = transactionStatusMeta(tx);
                return (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {tx.fromWallet ? (
                        tx.fromWallet.user.fullName
                      ) : tx.note === 'Admin added funds' ? (
                        <Badge tone="purple">Admin</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {tx.toWallet?.user.fullName ?? tx.receiverName ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatMoney(tx.amount, tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={categoryTone[tx.category] ?? 'gray'}>{tx.category}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-4 py-3">
                      {tx.fraudAlerts.length > 0 ? (
                        <Badge tone="red">Flagged</Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} ({total} transactions)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
