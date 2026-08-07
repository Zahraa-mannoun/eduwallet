import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiResponse, KYCStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { SuspendModal } from '../components/SuspendModal';
import { UnsuspendModal } from '../components/UnsuspendModal';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { getKycDisplayStatus } from '../lib/kycDisplayStatus';
import { formatDate } from '../lib/format';
import type { AdminUser } from '../types/admin';

const KYC_FILTERS: Array<KYCStatus | 'ALL'> = ['ALL', 'VERIFIED', 'PENDING', 'REJECTED'];

export function Students() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState<KYCStatus | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [unsuspendTarget, setUnsuspendTarget] = useState<AdminUser | null>(null);

  const limit = 20;

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<
        ApiResponse<{ users: AdminUser[]; total: number; page: number; limit: number }>
      >('/admin/users', {
        params: {
          page,
          limit,
          userType: 'STUDENT',
          ...(kycFilter !== 'ALL' ? { kycStatus: kycFilter } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });
      const data = unwrap(response.data);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, kycFilter, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useVisibilityRefetch(loadUsers);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    void loadUsers();
  };

  const handleSuspendToggleClick = (user: AdminUser) => {
    if (user.suspended) {
      setUnsuspendTarget(user);
    } else {
      setSuspendTarget(user);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email…"
            className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Search
          </button>
        </form>

        <div className="flex gap-1">
          {KYC_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setKycFilter(status);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                kycFilter === status
                  ? 'bg-primary text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">KYC Status</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Actions</th>
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
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No students found
                </td>
              </tr>
            )}
            {!isLoading &&
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>{user.fullName}</span>
                      {user.suspended && user.hasSupportMessage && (
                        <button
                          type="button"
                          title="View support message"
                          onClick={() => navigate(`/support?highlight=${user.id}`)}
                          className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          💬
                        </button>
                      )}
                      {user.suspended && (
                        <span className="text-xs font-normal text-red-500">(suspended)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const status = getKycDisplayStatus(user.kycStatus, user.hasDocuments);
                      return <Badge tone={status.tone}>{status.label}</Badge>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSuspendToggleClick(user)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {user.suspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} ({total} students)
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

      {suspendTarget && (
        <SuspendModal
          user={suspendTarget}
          onClose={() => setSuspendTarget(null)}
          onDone={() => {
            setSuspendTarget(null);
            void loadUsers();
          }}
        />
      )}

      {unsuspendTarget && (
        <UnsuspendModal
          user={unsuspendTarget}
          onClose={() => setUnsuspendTarget(null)}
          onDone={() => {
            setUnsuspendTarget(null);
            void loadUsers();
          }}
        />
      )}
    </div>
  );
}
