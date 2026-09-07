import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Modal } from '../components/Modal';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { PersonCell } from '../components/PersonCell';
import { SkeletonRows } from '../components/SkeletonRows';
import { TableCard, TABLE_HEAD_ROW_CLASS, TABLE_TD_CLASS, TABLE_TH_CLASS, tableRowClass } from '../components/TableCard';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDate, formatDateTime, formatRelativeTime } from '../lib/format';
import type { SupportMessageRow } from '../types/admin';

function ReplyModal({
  message,
  onClose,
  onDone,
}: {
  message: SupportMessageRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) {
      setError('A reply is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/support/messages/${message.id}/reply`, { message: reply });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Reply — ${message.user.fullName}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{message.subject ?? '—'}</p>
          <p className="mt-1">{message.message}</p>
        </div>

        <div>
          <label htmlFor="reply-message" className="mb-1 block text-sm font-medium text-slate-700">
            Reply
          </label>
          <textarea
            id="reply-message"
            required
            rows={3}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Once a message has been replied to, that's final — no textarea, no way to reply again, just
// the original message and the reply it already got, both as quoted blocks.
function ViewReplyModal({
  message,
  onClose,
}: {
  message: SupportMessageRow;
  onClose: () => void;
}) {
  return (
    <Modal title={`Reply — ${message.user.fullName}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Original Message
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            {message.subject && <p className="font-medium text-slate-800">{message.subject}</p>}
            <p className="mt-1">{message.message}</p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">Admin Reply</p>
          <div className="rounded-xl border-l-4 border-l-primary bg-primary-50/60 p-3 text-sm text-slate-700">
            {message.replyMessage}
          </div>
          {message.repliedAt && (
            <p className="mt-1.5 text-xs text-slate-400">{formatDateTime(message.repliedAt)}</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AgentMessages() {
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<SupportMessageRow | null>(null);
  const [viewReplyTarget, setViewReplyTarget] = useState<SupportMessageRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<SupportMessageRow[]>>('/support/messages');
      setMessages(unwrap(response.data).filter((message) => message.type === 'AGENT_MESSAGE'));
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

  return (
    <div className="space-y-4">
      <PageHeader title="Agent Messages" subtitle="Messages sent by agents from the agent portal" />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableCard title="Messages" subtitle={`${messages.length} shown`}>
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className={TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={TABLE_TH_CLASS}>Agent</th>
              <th className={TABLE_TH_CLASS}>Message</th>
              <th className={TABLE_TH_CLASS}>Date</th>
              <th className={TABLE_TH_CLASS}>Status</th>
              <th className={TABLE_TH_CLASS}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={5} />}
            {!isLoading && messages.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="No agent messages yet" />
                </td>
              </tr>
            )}
            {!isLoading &&
              messages.map((message, index) => (
                <tr key={message.id} className={tableRowClass(index)}>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    <PersonCell name={message.user.fullName} email={message.user.email} />
                  </td>
                  <td className={`${TABLE_TD_CLASS} max-w-sm align-top`}>
                    {message.subject && (
                      <p className="truncate font-medium text-slate-800">{message.subject}</p>
                    )}
                    <p className="whitespace-normal break-words text-sm text-slate-500">{message.message}</p>
                  </td>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    <p className="text-slate-700">{formatDate(message.createdAt)}</p>
                    <p className="text-xs text-slate-400">{formatRelativeTime(message.createdAt)}</p>
                  </td>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    <DotBadge tone={message.status === 'UNREAD' ? 'yellow' : 'green'}>
                      {message.status === 'UNREAD' ? 'Unread' : 'Read'}
                    </DotBadge>
                  </td>
                  <td className={`${TABLE_TD_CLASS} align-top`}>
                    <div className="flex flex-wrap gap-2">
                      {message.status === 'UNREAD' && (
                        <button
                          type="button"
                          disabled={busyMessageId === message.id}
                          onClick={() => void markAsRead(message)}
                          className="rounded-full border-2 border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.03] hover:bg-slate-50 disabled:opacity-40"
                        >
                          Mark as Read
                        </button>
                      )}
                      {message.replyMessage !== null ? (
                        <button
                          type="button"
                          onClick={() => setViewReplyTarget(message)}
                          className="rounded-full border-2 border-primary-200 px-3 py-1 text-xs font-semibold text-primary transition-all duration-200 hover:scale-[1.03] hover:bg-primary-50"
                        >
                          View Reply
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReplyTarget(message)}
                          className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:bg-primary-600"
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableCard>

      {replyTarget && (
        <ReplyModal
          message={replyTarget}
          onClose={() => setReplyTarget(null)}
          onDone={() => {
            setReplyTarget(null);
            void load();
          }}
        />
      )}

      {viewReplyTarget && (
        <ViewReplyModal message={viewReplyTarget} onClose={() => setViewReplyTarget(null)} />
      )}
    </div>
  );
}
