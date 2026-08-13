import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ApiResponse } from '@eduwallet/shared';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { SkeletonRows } from '../components/SkeletonRows';
import { useVisibilityRefetch } from '../hooks/useVisibilityRefetch';
import { formatDateTime } from '../lib/format';
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Sending…' : 'Send Reply'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AgentMessages() {
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<SupportMessageRow | null>(null);

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
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Agent Messages</h1>
        <p className="mt-1 text-sm text-slate-500">Messages sent by agents from the agent portal.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Agent</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <SkeletonRows columns={6} />}
            {!isLoading && messages.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="No agent messages yet" />
                </td>
              </tr>
            )}
            {!isLoading &&
              messages.map((message) => (
                <tr key={message.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{message.user.fullName}</div>
                    <div className="text-xs text-slate-500">{message.user.email}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs font-medium text-slate-800">
                    {message.subject ?? '—'}
                  </td>
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
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          Mark as Read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setReplyTarget(message)}
                        className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-100"
                      >
                        Reply
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
