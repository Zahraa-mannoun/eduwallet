import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Building2, CheckCircle, MessageCircle, Wallet } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { AddFundsModal } from '../components/AddFundsModal';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { PersonCell } from '../components/PersonCell';
import { SearchInput } from '../components/SearchInput';
import { SkeletonRows } from '../components/SkeletonRows';
import { SuspendModal } from '../components/SuspendModal';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
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
      <PageHeader title="Institutions" subtitle="Manage institution accounts and scholarship disbursements" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title="All Institutions"
        subtitle={`${total} institution${total === 1 ? '' : 's'}`}
        actions={<SearchInput value={search} onChange={setSearch} onSubmit={handleSearchSubmit} />}
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Institution</th>
              <th className={TABLE_TH_CLASS}>Total Disbursements</th>
              <th className={TABLE_TH_CLASS}>Joined</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={4} />}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={<Building2 className="h-8 w-8" />} title="No institutions found" />
                </td>
              </tr>
            )}
            {!isLoading &&
              users.map((user, index) => (
                <tr key={user.id} className={tableRowClass(index)}>
                  <td className={TABLE_TD_CLASS}>
                    <PersonCell
                      name={user.fullName}
                      email={user.email}
                      extra={
                        <>
                          {user.suspended && user.hasSupportMessage && (
                            <button
                              type="button"
                              title="View support message"
                              onClick={() => navigate(`/support?highlight=${user.id}`)}
                              className="rounded-lg p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {user.suspended && (
                            <span className="whitespace-nowrap text-xs font-normal text-red-500">
                              (suspended)
                            </span>
                          )}
                        </>
                      }
                    />
                  </td>
                  <td className={TABLE_TD_CLASS}>
                    {user.disbursementsCount ? (
                      <span className="text-base font-bold text-slate-900">{user.disbursementsCount}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDate(user.createdAt)}</td>
                  <td className={TABLE_TD_CLASS}>
                    <div className="flex flex-wrap gap-2">
                      {user.suspended ? (
                        <button
                          type="button"
                          disabled={busyUserId === user.id}
                          onClick={() => void toggleSuspend(user)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyUserId === user.id}
                          onClick={() => void toggleSuspend(user)}
                          className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition-all duration-200 hover:scale-[1.03] hover:bg-red-50 disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Suspend
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFundsUser(user)}
                        className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary transition-all duration-200 hover:scale-[1.03] hover:bg-primary-100"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        Add Funds
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableCard>

      {!isLoading && users.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          itemLabel="institutions"
          onPageChange={setPage}
        />
      )}

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
