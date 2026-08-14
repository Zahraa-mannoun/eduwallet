import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, PiggyBank } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDateTime } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
import type { RolloverHistoryRow } from '../types/admin';

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  if (!year || !monthNum) return month;
  return new Date(year, monthNum - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function RolloverHistory() {
  const [rows, setRows] = useState<RolloverHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<RolloverHistoryRow[]>>('/admin/rollover-history');
      setRows(unwrap(response.data));
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
      <PageHeader title="Rollover History" subtitle="Monthly personal savings rollover log" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title="Rollovers" subtitle={`${rows.length} month${rows.length === 1 ? '' : 's'}`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Month</th>
              <th className={TABLE_TH_CLASS}>Students Affected</th>
              <th className={TABLE_TH_CLASS}>Total Rolled Over</th>
              <th className={TABLE_TH_CLASS}>Triggered At</th>
              <th className={TABLE_TH_CLASS}>Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} avatarColumn={false} />}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={<PiggyBank className="h-8 w-8" />} title="No rollovers triggered yet" />
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((row, index) => {
                const isExpanded = expandedMonth === row.month;
                return (
                  <Fragment key={row.month}>
                    <tr
                      className={tableRowClass(index, 'cursor-pointer')}
                      onClick={() => setExpandedMonth(isExpanded ? null : row.month)}
                    >
                      <td className={`${TABLE_TD_CLASS} font-medium text-slate-900`}>
                        {formatMonthLabel(row.month)}
                      </td>
                      <td className={TABLE_TD_CLASS}>{row.studentCount}</td>
                      <td className={`${TABLE_TD_CLASS} font-bold text-slate-900`}>
                        ${row.totalAmount.toFixed(2)}
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDateTime(row.triggeredAt)}</td>
                      <td className={TABLE_TD_CLASS}>
                        <span className="inline-flex items-center gap-2">
                          <DotBadge tone="green">Rollover</DotBadge>
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          )}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-2.5">
                            {row.students.map((student) => (
                              <div
                                key={student.id}
                                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <PersonCell name={student.name} email={student.email} />
                                <div className="flex flex-col items-start gap-1 sm:items-end">
                                  <p className="font-bold text-slate-900">${student.amount.toFixed(2)}</p>
                                  {student.categories.length > 0 && (
                                    <p className="text-xs text-slate-500">
                                      {student.categories
                                        .map((c) => `${humanizeEnum(c.category)} $${c.amount.toFixed(2)}`)
                                        .join(' · ')}
                                    </p>
                                  )}
                                </div>
                              </div>
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
      </TableCard>
    </div>
  );
}
