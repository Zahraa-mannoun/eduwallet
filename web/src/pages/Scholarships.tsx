import { Fragment, useCallback, useEffect, useState } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { categoryTone } from '../lib/badgeTones';
import { formatDate, formatMoney } from '../lib/format';
import type { TransactionRow } from '../types/admin';

type ScholarshipRow = {
  key: string;
  institutionName: string;
  studentsCount: number;
  totalAmount: number;
  currency: string;
  category: string;
  date: string;
  studentNames: string[];
};

const MAX_PAGES = 5;

async function fetchAllTransactions(): Promise<TransactionRow[]> {
  const limit = 100;
  const first = await api.get<ApiResponse<{ transactions: TransactionRow[]; total: number }>>(
    '/admin/transactions',
    { params: { page: 1, limit } }
  );
  const firstData = unwrap(first.data);
  const all = [...firstData.transactions];
  const totalPages = Math.min(MAX_PAGES, Math.ceil(firstData.total / limit));

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
      api
        .get<ApiResponse<{ transactions: TransactionRow[] }>>('/admin/transactions', {
          params: { page: index + 2, limit },
        })
        .then((res) => unwrap(res.data).transactions)
    )
  );

  return [...all, ...rest.flat()];
}

function aggregate(transactions: TransactionRow[]): ScholarshipRow[] {
  const institutionTx = transactions.filter((tx) => tx.fromWallet?.user.userType === 'INSTITUTION');

  const groups = new Map<string, ScholarshipRow & { studentNamesById: Map<string, string> }>();

  for (const tx of institutionTx) {
    const institutionName = tx.fromWallet?.user.fullName ?? 'Unknown Institution';
    const key = `${tx.fromWallet?.user.id}-${tx.category}`;
    const existing = groups.get(key);
    const studentId = tx.toWallet?.user.id ?? tx.toWalletId ?? tx.id;
    const studentName = tx.toWallet?.user.fullName ?? 'Unknown Student';

    if (existing) {
      existing.totalAmount += Number(tx.amount);
      existing.studentNamesById.set(studentId, studentName);
      if (new Date(tx.createdAt) > new Date(existing.date)) {
        existing.date = tx.createdAt;
      }
    } else {
      groups.set(key, {
        key,
        institutionName,
        studentsCount: 0,
        totalAmount: Number(tx.amount),
        currency: tx.currency,
        category: tx.category,
        date: tx.createdAt,
        studentNames: [],
        studentNamesById: new Map([[studentId, studentName]]),
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      studentsCount: group.studentNamesById.size,
      studentNames: [...group.studentNamesById.values()].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function Scholarships() {
  const [rows, setRows] = useState<ScholarshipRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const transactions = await fetchAllTransactions();
      setRows(aggregate(transactions));
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

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Institution Name</th>
              <th className="px-4 py-3 text-left">Students Count</th>
              <th className="px-4 py-3 text-left">Total Amount</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No scholarship disbursements found
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row) => {
                const isExpanded = expandedKey === row.key;
                return (
                  <Fragment key={row.key}>
                    <tr
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpandedKey(isExpanded ? null : row.key)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                          </svg>
                          {row.institutionName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.studentsCount}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatMoney(row.totalAmount, row.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={categoryTone[row.category] ?? 'gray'}>{row.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.date)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="px-4 py-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase text-slate-500">
                            Recipient Students
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {row.studentNames.map((name) => (
                              <span
                                key={name}
                                className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-slate-200"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
