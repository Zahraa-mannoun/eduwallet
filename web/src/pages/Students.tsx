import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, CheckCircle, GraduationCap, MessageCircle } from 'lucide-react';
import type { ApiResponse, KYCStatus } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { PersonCell } from '../components/PersonCell';
import { SearchInput } from '../components/SearchInput';
import { SkeletonRows } from '../components/SkeletonRows';
import { SuspendModal } from '../components/SuspendModal';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { UnsuspendModal } from '../components/UnsuspendModal';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { useSocketRefetch } from '../hooks/useSocketRefetch';
import { getKycDisplayStatus } from '../lib/kycDisplayStatus';
import { formatDate } from '../lib/format';
import { humanizeEnum } from '../lib/humanize';
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
  useSocketRefetch(loadUsers);

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
      <PageHeader title="Students" subtitle="Manage student accounts and KYC status" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title="All Students"
        subtitle={`${total} student${total === 1 ? '' : 's'}`}
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} onSubmit={handleSearchSubmit} />
            <FilterTabs
              tabs={KYC_FILTERS.map((status) => ({
                value: status,
                label: status === 'ALL' ? 'All' : humanizeEnum(status),
              }))}
              value={kycFilter}
              onChange={(value) => {
                setKycFilter(value);
                setPage(1);
              }}
            />
          </>
        }
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Student</th>
              <th className={TABLE_TH_CLASS}>KYC Status</th>
              <th className={TABLE_TH_CLASS}>Joined</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={4} />}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon={<GraduationCap className="h-8 w-8" />}
                    title="No students found"
                    message="Try adjusting your search or filter."
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              users.map((user, index) => {
                const status = getKycDisplayStatus(user.kycStatus, user.hasDocuments);
                return (
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
                      <DotBadge tone={status.tone}>{status.label}</DotBadge>
                    </td>
                    <td className={`${TABLE_TD_CLASS} text-slate-500`}>{formatDate(user.createdAt)}</td>
                    <td className={TABLE_TD_CLASS}>
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
                    </td>
                  </tr>
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
          itemLabel="students"
          onPageChange={setPage}
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
