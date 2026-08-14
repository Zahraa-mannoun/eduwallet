import { Fragment, useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, CheckCircle, ChevronDown, ChevronRight, MessageCircle, Users, Wallet } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { AddFundsModal } from '../components/AddFundsModal';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { PersonCell } from '../components/PersonCell';
import { SearchInput } from '../components/SearchInput';
import { SkeletonRows } from '../components/SkeletonRows';
import { SuspendModal } from '../components/SuspendModal';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { UnsuspendModal } from '../components/UnsuspendModal';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDate } from '../lib/format';
import type { AdminUser, RelationshipRow } from '../types/admin';

export function Parents() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fundsUser, setFundsUser] = useState<AdminUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [unsuspendTarget, setUnsuspendTarget] = useState<AdminUser | null>(null);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

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
          userType: 'PARENT',
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

  const loadRelationships = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<RelationshipRow[]>>('/admin/relationships');
      setRelationships(unwrap(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void loadRelationships();
  }, [loadRelationships]);

  useVisibilityRefetch(loadRelationships);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    void loadUsers();
  };

  const toggleExpanded = (userId: string) => {
    setExpandedParentId((current) => (current === userId ? null : userId));
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
      <PageHeader title="Parents" subtitle="Manage parent accounts and linked students" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title="All Parents"
        subtitle={`${total} parent${total === 1 ? '' : 's'}`}
        actions={<SearchInput value={search} onChange={setSearch} onSubmit={handleSearchSubmit} />}
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Parent</th>
              <th className={TABLE_TH_CLASS}>Linked Students</th>
              <th className={TABLE_TH_CLASS}>Joined</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={4} />}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={<Users className="h-8 w-8" />} title="No parents found" />
                </td>
              </tr>
            )}
            {!isLoading &&
              users.map((user, index) => {
                const isExpanded = expandedParentId === user.id;
                const linkedStudents = relationships.filter(
                  (relationship) => relationship.parentUserId === user.id
                );
                const linkedCount = linkedStudents.length;
                return (
                  <Fragment key={user.id}>
                    <tr className={tableRowClass(index)}>
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
                        {linkedCount === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(user.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                              isExpanded
                                ? 'bg-primary text-white'
                                : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            }`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {linkedCount}
                          </button>
                        )}
                      </td>
                      <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDate(user.createdAt)}</td>
                      <td className={TABLE_TD_CLASS}>
                        <div className="flex flex-wrap gap-2">
                          {user.suspended ? (
                            <button
                              type="button"
                              onClick={() => handleSuspendToggleClick(user)}
                              className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-50"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              Unsuspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSuspendToggleClick(user)}
                              className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition-all duration-200 hover:scale-[1.03] hover:bg-red-50"
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
                    {isExpanded && linkedCount > 0 && (
                      <tr>
                        <td colSpan={4} className="bg-slate-50/70 px-6 py-4">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Linked Students
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {linkedStudents.map((relationship) => (
                              <span
                                key={relationship.id}
                                className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-xs text-slate-700 ring-1 ring-inset ring-slate-200"
                                title={relationship.student.email}
                              >
                                <Avatar name={relationship.student.fullName} size="sm" />
                                <span className="font-medium text-slate-900">
                                  {relationship.student.fullName}
                                </span>
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
      </TableCard>

      {!isLoading && users.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          itemLabel="parents"
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
