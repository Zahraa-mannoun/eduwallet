import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AgentMessage, ApiResponse, Notification } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { Badge } from '../components/Badge';
import { formatDateTime } from '../lib/format';
import { IconInbox, IconMail } from '../components/icons';

export function Messages() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [replies, setReplies] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [messagesResponse, notificationsResponse] = await Promise.all([
        api.get<ApiResponse<AgentMessage[]>>('/agent/messages'),
        api.get<
          ApiResponse<{ notifications: Notification[]; total: number; page: number; limit: number }>
        >('/notifications', { params: { page: 1, limit: 50 } }),
      ]);
      setMessages(unwrap(messagesResponse.data));
      setReplies(
        unwrap(notificationsResponse.data).notifications.filter(
          (notification) => notification.type === 'SUPPORT_MESSAGE_REPLY'
        )
      );
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSendError(null);
    setIsSending(true);
    try {
      await api.post('/agent/messages', { subject, message });
      setSubject('');
      setMessage('');
      await load();
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">Send a message to the EduWallet admin team.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <IconMail className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">New Message</h2>
        </div>
        <form className="max-w-lg space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-slate-700">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="message" className="mb-1 block text-sm font-medium text-slate-700">
              Message
            </label>
            <textarea
              id="message"
              required
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {sendError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {sendError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            {isSending ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>

      {loadError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}

      {replies.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Replies from Admin</h2>
          <ul className="mt-3 space-y-3">
            {replies.map((reply) => (
              <li key={reply.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm text-slate-700">{reply.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(reply.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
            <IconInbox className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">You haven&apos;t sent any messages yet</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            Messages you send to the admin team will show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Message</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading &&
                messages.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.subject ?? '—'}</td>
                    <td className="px-4 py-3 max-w-sm text-slate-700">{item.message}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.status === 'UNREAD' ? 'yellow' : 'gray'}>
                        {item.status === 'UNREAD' ? 'Unread' : 'Read'}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
