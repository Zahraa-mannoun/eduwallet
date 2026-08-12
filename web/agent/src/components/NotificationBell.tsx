import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResponse, Notification } from '../types';
import { api, getErrorMessage, unwrap } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { IconBell } from './icons';

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
      setUnreadCount(unwrap(response.data).count);
    } catch {
      // silent — the bell just won't show a fresh count until the next successful poll
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<
        ApiResponse<{ notifications: Notification[]; total: number; page: number; limit: number }>
      >('/notifications', { params: { page: 1, limit: 10 } });
      setNotifications(unwrap(response.data).notifications);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    const interval = setInterval(() => void loadUnreadCount(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!isOpen) return;
    void loadNotifications();
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.read) return;
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifications"
      >
        <IconBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center px-4 py-6">
                <svg className="h-5 w-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            )}
            {!isLoading && error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
            {!isLoading && !error && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
            )}
            {!isLoading &&
              !error &&
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${
                    notification.read ? '' : 'bg-primary-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                    {!notification.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{notification.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(notification.createdAt)}
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
