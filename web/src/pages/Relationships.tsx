import { useEffect, useState } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import type { RelationshipRow } from '../types/admin';

export function Relationships() {
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
    }
    void load();
  }, []);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Parent Name</th>
              <th className="px-4 py-3 text-left">Parent Email</th>
              <th className="px-4 py-3 text-left">Student Name</th>
              <th className="px-4 py-3 text-left">Student Email</th>
              <th className="px-4 py-3 text-left">Threshold</th>
              <th className="px-4 py-3 text-left">Allowed Categories</th>
              <th className="px-4 py-3 text-left">Pending Approvals</th>
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
            {!isLoading && relationships.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No parent-student links found
                </td>
              </tr>
            )}
            {!isLoading &&
              relationships.map((link) => (
                <tr key={link.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{link.parent.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{link.parent.email}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{link.student.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{link.student.email}</td>
                  <td className="px-4 py-3 text-slate-700">{link.approvalThreshold}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {link.categories.length === 0 && <span className="text-slate-300">—</span>}
                      {link.categories.map((cat) => (
                        <Badge key={cat} tone="blue">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {link.pendingApprovalsCount > 0 ? (
                      <Badge tone="yellow">{link.pendingApprovalsCount}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
