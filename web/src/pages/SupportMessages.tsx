import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDateTime } from '../lib/format';
import type { SupportMessageRow } from '../types/admin';

export function SupportMessages() {
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get('highlight');
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);

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

  const unsuspend = async (message: SupportMessageRow) => {
    setBusyMessageId(message.id);
    try {
      await api.patch(`/admin/users/${message.user.id}/unsuspend`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyMessageId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Support Messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Messages sent by suspended users asking for their case to be reviewed.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && messages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No support messages yet
                </td>
              </tr>
            )}
            {!isLoading &&
              messages.map((message) => {
                const isHighlighted = message.user.id === highlightUserId;
                return (
                  <tr
                    key={message.id}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    className={isHighlighted ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : undefined}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{message.user.fullName}</div>
                      <div className="text-xs text-slate-500">{message.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{message.user.userType}</td>
                    <td className="px-4 py-3 max-w-sm text-slate-700">{message.message}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(message.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={message.status === 'UNREAD' ? 'yellow' : 'gray'}>
                        {message.status === 'UNREAD' ? 'Unread' : 'Read'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {message.status === 'UNREAD' && (
                          <button
                            type="button"
                            disabled={busyMessageId === message.id}
                            onClick={() => void markAsRead(message)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          >
                            Mark as Read
                          </button>
                        )}
                        {message.user.suspended ? (
                          <button
                            type="button"
                            disabled={busyMessageId === message.id}
                            onClick={() => void unsuspend(message)}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                          >
                            Unsuspend
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Not suspended</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
