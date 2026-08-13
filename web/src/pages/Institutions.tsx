import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { AddFundsModal } from '../components/AddFundsModal';
import { SuspendModal } from '../components/SuspendModal';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/SkeletonRows';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDate } from '../lib/format';
import type { AdminUser } from '../types/admin';

export function Institutions() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [fundsUser, setFundsUser] = useState<AdminUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);

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
          userType: 'INSTITUTION',
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
  }, [page, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useVisibilityRefetch(loadUsers);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    void loadUsers();
  };

  const toggleSuspend = async (user: AdminUser) => {
    if (!user.suspended) {
      setSuspendTarget(user);
      return;
    }
    setBusyUserId(user.id);
    try {
      await api.patch(`/admin/users/${user.id}/unsuspend`);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearchSubmit}
        className="flex max-w-xs gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Search
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Total Disbursements</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} />}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="No institutions found" />
                </td>
              </tr>
            )}
            {!isLoading &&
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>{user.fullName}</span>
                      {user.suspended && user.hasSupportMessage && (
                        <button
                          type="button"
                          title="View support message"
                          onClick={() => navigate(`/support?highlight=${user.id}`)}
                          className="rounded-lg p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                  <td className="px-4 py-3 text-slate-600">{user.disbursementsCount ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyUserId === user.id}
                        onClick={() => void toggleSuspend(user)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {user.suspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFundsUser(user)}
                        className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-100"
                      >
                        Add Funds
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} ({total} institutions)
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

      {fundsUser && (
        <AddFundsModal
          userId={fundsUser.id}
          userName={fundsUser.fullName}
          defaultCurrency={fundsUser.wallets[0]?.currency}
          onClose={() => setFundsUser(null)}
          onDone={() => {
            setFundsUser(null);
            void loadUsers();
          }}
        />
      )}

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
    </div>
  );
}
