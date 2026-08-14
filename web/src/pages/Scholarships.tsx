import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { categoryTone } from '../lib/badgeTones';
import { formatDate, formatMoney } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
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
      <PageHeader title="Scholarships" subtitle="Institutional scholarship disbursements, grouped by recipient category" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title="Disbursements" subtitle={`${rows.length} groups`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Institution Name</th>
              <th className={TABLE_TH_CLASS}>Students Count</th>
              <th className={TABLE_TH_CLASS}>Total Amount</th>
              <th className={TABLE_TH_CLASS}>Category</th>
              <th className={TABLE_TH_CLASS}>Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} avatarColumn={false} />}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<GraduationCap className="h-8 w-8" />}
                    title="No scholarship disbursements found"
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row, index) => {
                const isExpanded = expandedKey === row.key;
                return (
                  <Fragment key={row.key}>
                    <tr
                      className={tableRowClass(index, 'cursor-pointer')}
                      onClick={() => setExpandedKey(isExpanded ? null : row.key)}
                    >
                      <td className={`${TABLE_TD_CLASS} font-medium text-slate-900`}>
                        <span className="inline-flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          )}
                          {row.institutionName}
                        </span>
                      </td>
                      <td className={TABLE_TD_CLASS}>
                        <Badge tone="blue">{row.studentsCount}</Badge>
                      </td>
                      <td className={`${TABLE_TD_CLASS} font-bold text-slate-900`}>
                        {formatMoney(row.totalAmount, row.currency)}
                      </td>
                      <td className={TABLE_TD_CLASS}>
                        <Badge tone={categoryTone[row.category] ?? 'gray'}>{humanizeEnum(row.category)}</Badge>
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDate(row.date)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Recipient Students
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {row.studentNames.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center gap-2 rounded-full bg-slate-50 py-1 pl-1 pr-3 text-xs text-slate-700 ring-1 ring-inset ring-slate-200"
                                >
                                  <Avatar name={name} size="sm" />
                                  <span className="font-medium text-slate-900">{name}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
