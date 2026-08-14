import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Bell, ChevronDown, ChevronUp, Inbox, MessageSquare, Send } from 'lucide-react';
import type { AgentMessage, ApiResponse, Notification } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { DotBadge } from '../components/DotBadge';
import { EmptyState } from '../components/EmptyState';
import { FilterTabs } from '../components/FilterTabs';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime, formatRelativeTime } from '../lib/format';
import { useSocketRefetch } from '../hooks/useSocketRefetch';

type Tab = 'messages' | 'fromAdmin';

export function Messages() {
  const [activeTab, setActiveTab] = useState<Tab>('messages');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      setNotifications(unwrap(notificationsResponse.data).notifications);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Any socket event (a new reply, a new notification, ...) triggers an instant refetch — this
  // is also what keeps the thread + notification list current without the agent ever reloading.
  useSocketRefetch(load);

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

  // /notifications/:id/read is self-owned and role-agnostic (unlike /support/messages/:id/read,
  // which is admin-only — that status reflects whether admin has read the agent's message, not
  // the other way around). This is what "the agent marks a message as read" actually maps to.
  const markNotificationRead = async (notification: Notification) => {
    if (notification.read) return;
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  };

  const replyFor = (messageId: string) =>
    notifications.find((n) => n.type === 'SUPPORT_MESSAGE_REPLY' && n.relatedId === messageId);

  // "From Admin" only ever shows what an admin sent via the Notify button (ADMIN_MESSAGE) —
  // SUPPORT_MESSAGE_REPLY already surfaces inline under its own message thread above, and every
  // other type (FRAUD_ALERT, KYC_UPDATE, ...) is a system notification with nothing to do with
  // agent-admin messaging.
  const fromAdmin = notifications.filter((n) => n.type === 'ADMIN_MESSAGE');

  const toggleExpanded = (item: AgentMessage) => {
    const reply = replyFor(item.id);
    const nextExpanded = expandedId === item.id ? null : item.id;
    setExpandedId(nextExpanded);
    // Opening the thread is what "viewing" the reply means — mark it read the moment it's shown.
    if (nextExpanded && reply) {
      void markNotificationRead(reply);
    }
  };

  const unreadFromAdminCount = fromAdmin.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" subtitle="Send messages to, and hear back from, the EduWallet admin team" />

      <FilterTabs
        tabs={[
          { value: 'messages', label: 'Messages' },
          {
            value: 'fromAdmin',
            label: unreadFromAdminCount > 0 ? `From Admin (${unreadFromAdminCount})` : 'From Admin',
          },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {loadError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}

      {activeTab === 'messages' ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">New Message</h2>
                <p className="text-sm text-slate-500">Reach out to the admin team with a question or issue</p>
              </div>
            </div>

            <form className="max-w-lg space-y-4 p-6" onSubmit={handleSubmit}>
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
                  className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
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
                  className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              {sendError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {sendError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#4a7fd4] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                <Send className="h-4 w-4" />
                {isSending ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </div>

          {!isLoading && messages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="You haven't sent any messages yet"
                message="Messages you send to the admin team will show up here."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {isLoading && (
                <p className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-400 shadow-sm">
                  Loading…
                </p>
              )}
              {!isLoading &&
                messages.map((item) => {
                  const reply = replyFor(item.id);
                  const expanded = expandedId === item.id;
                  return (
                    <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item)}
                        className="w-full p-5 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bold text-slate-900">{item.subject ?? '—'}</p>
                          <DotBadge tone={item.status === 'UNREAD' ? 'yellow' : 'gray'}>
                            {item.status === 'UNREAD' ? 'Unread' : 'Read'}
                          </DotBadge>
                        </div>
                        <p className="mt-1.5 truncate text-sm text-slate-500">{item.message}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                          {reply ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                              View Reply
                              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Awaiting reply</span>
                          )}
                        </div>
                      </button>

                      {expanded && reply && (
                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                          <div className="rounded-xl border-l-4 border-l-primary bg-white px-4 py-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Admin replied:
                            </p>
                            <p className="mt-1 text-sm text-slate-700">{reply.message}</p>
                            <p className="mt-1.5 text-xs text-slate-400">{formatDateTime(reply.createdAt)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!isLoading && fromAdmin.length === 0 ? (
            <EmptyState icon={<Bell className="h-8 w-8" />} title="No messages from admin yet" />
          ) : (
            <div className="divide-y divide-slate-100">
              {fromAdmin.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void markNotificationRead(notification)}
                  className={`flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-slate-50 ${
                    notification.read ? '' : 'bg-primary-50/40'
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-transparent' : 'bg-primary'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{notification.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{notification.message}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">{formatRelativeTime(notification.createdAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
