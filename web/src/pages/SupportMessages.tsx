import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, Inbox, ShieldCheck } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { DotBadge } from '../components/DotBadge';
import { UnsuspendModal } from '../components/UnsuspendModal';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDate, formatRelativeTime } from '../lib/format';
import { roleTone } from '../lib/badgeTones';
import { humanizeEnum } from '../lib/humanize';
import type { SupportMessageRow } from '../types/admin';

type Tab = 'appeals' | 'general';

export function SupportMessages() {
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get('highlight');
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('appeals');

  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [unsuspendTarget, setUnsuspendTarget] = useState<SupportMessageRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<SupportMessageRow[]>>('/support/messages');
      setMessages(unwrap(response.data));
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

  useEffect(() => {
    if (highlightUserId && messages.length > 0) {
      highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightUserId, messages]);

  const markAsRead = async (message: SupportMessageRow) => {
    if (message.status === 'READ') return;
    setBusyMessageId(message.id);
    try {
      await api.patch(`/support/messages/${message.id}/read`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyMessageId(null);
    }
  };

  const appealMessages = messages.filter((message) => message.type === 'SUSPENSION_APPEAL');
  const generalMessages = messages.filter((message) => message.type === 'GENERAL');
  const rows = activeTab === 'appeals' ? appealMessages : generalMessages;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support Messages"
        subtitle="Suspension appeals from suspended users, and general support requests"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard
        title={activeTab === 'appeals' ? 'Suspension Appeals' : 'General Support'}
        subtitle={`${rows.length} shown`}
        actions={
          <FilterTabs
            tabs={[
              { value: 'appeals', label: 'Suspension Appeals' },
              { value: 'general', label: 'General Support' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        }
      >
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>User</th>
              <th className={TABLE_TH_CLASS}>Message</th>
              <th className={TABLE_TH_CLASS}>Date</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} />}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<Inbox className="h-8 w-8" />}
                    title={`No ${activeTab === 'appeals' ? 'support messages' : 'general support requests'} yet`}
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              rows.map((message, index) => {
                const isHighlighted = message.user.id === highlightUserId;
                return (
                  <tr
                    key={message.id}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    className={
                      isHighlighted
                        ? 'bg-amber-50 ring-1 ring-inset ring-amber-300'
                        : tableRowClass(index)
                    }
                  >
                    <td className={TABLE_TD_CLASS}>
                      <PersonCell
                        name={message.user.fullName}
                        email={message.user.email}
                        extra={
                          <Badge tone={roleTone[message.user.userType] ?? 'gray'}>
                            {humanizeEnum(message.user.userType)}
                          </Badge>
                        }
                      />
                    </td>
                    <td className={`${TABLE_TD_CLASS} max-w-sm`}>
                      {message.subject && (
                        <p className="truncate font-medium text-slate-800">{message.subject}</p>
                      )}
                      <p className="truncate text-sm italic text-slate-500">{message.message}</p>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <p className="text-slate-700">{formatDate(message.createdAt)}</p>
                      <p className="text-xs text-slate-400">{formatRelativeTime(message.createdAt)}</p>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <DotBadge tone={message.status === 'UNREAD' ? 'yellow' : 'green'}>
                        {message.status === 'UNREAD' ? 'Unread' : 'Read'}
                      </DotBadge>
                    </td>
                    <td className={TABLE_TD_CLASS}>
                      <div className="flex flex-wrap gap-2">
                        {message.status === 'UNREAD' && (
                          <button
                            type="button"
                            disabled={busyMessageId === message.id}
                            onClick={() => void markAsRead(message)}
                            className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.03] hover:bg-slate-50 disabled:opacity-40"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Mark as Read
                          </button>
                        )}
                        {activeTab === 'appeals' &&
                          (message.user.suspended ? (
                            <button
                              type="button"
                              onClick={() => setUnsuspendTarget(message)}
                              className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-50"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Unsuspend
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Not suspended</span>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </TableCard>

      {unsuspendTarget && (
        <UnsuspendModal
          user={unsuspendTarget.user}
          onClose={() => setUnsuspendTarget(null)}
          onDone={() => {
            setUnsuspendTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
