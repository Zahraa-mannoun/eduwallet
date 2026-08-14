import { useCallback, useEffect, useState } from 'react';
import { Bell, Link2 } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { categoryTone } from '../lib/badgeTones';
import { humanizeEnum } from '../lib/humanize';
import type { RelationshipRow } from '../types/admin';

export function Relationships() {
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<RelationshipRow[]>>('/admin/relationships');
      setRelationships(unwrap(response.data));
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

  const parentCount = new Set(relationships.map((link) => link.parentUserId)).size;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Relationships"
        subtitle="Parent-student links, spending thresholds, and allowed categories"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title="Parent-Student Links"
        subtitle={`${relationships.length} links across ${parentCount} parents`}
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Parent</th>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>Threshold</th>
              <th className={TABLE_TH_CLASS}>Allowed Categories</th>
              <th className={TABLE_TH_CLASS}>Pending Approvals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} />}
            {!isLoading && relationships.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={<Link2 className="h-8 w-8" />} title="No parent-student links found" />
                </td>
              </tr>
            )}
            {!isLoading &&
              relationships.map((link, index) => {
                const threshold = Number(link.approvalThreshold);
                return (
                  <tr key={link.id} className={tableRowClass(index)}>
                    <td className={TABLE_TD_CLASS}>
                      <PersonCell name={link.parent.fullName} email={link.parent.email} />
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <PersonCell name={link.student.fullName} email={link.student.email} />
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      {threshold > 0 ? (
                        <Badge tone="blue">${threshold.toFixed(2)}</Badge>
                      ) : (
                        <Badge tone="gray">No limit</Badge>
                      )}
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {link.categories.length === 0 && <span className="text-slate-300">—</span>}
                        {link.categories.map((cat) => (
                          <Badge key={cat} tone={categoryTone[cat] ?? 'gray'}>
                            {humanizeEnum(cat)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      {link.pendingApprovalsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
                          <Bell className="h-3 w-3" />
                          {link.pendingApprovalsCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
