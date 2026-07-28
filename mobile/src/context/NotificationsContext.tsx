import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Notification } from '../types/api';
import * as notificationService from '../services/notificationService';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';

export type AppNotification = Notification;

type NotificationMeta = { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string };

const DEFAULT_META: NotificationMeta = { icon: 'bell-outline', color: '#2E5FAC' };

export const NOTIFICATION_META: Record<string, NotificationMeta> = {
  TRANSFER_RECEIVED: { icon: 'cash-plus', color: '#3DDC97' },
  CARD_PAYMENT: { icon: 'credit-card-outline', color: '#3DDC97' },
  STUDENT_SPENDING: { icon: 'cash-minus', color: '#2E5FAC' },
  STUDENT_CARD_PAYMENT: { icon: 'credit-card-outline', color: '#2E5FAC' },
  CARD_AUTO_RENEWED: { icon: 'credit-card-refresh-outline', color: '#3DDC97' },
  APPROVAL_NEEDED: { icon: 'clock-alert-outline', color: '#F59E0B' },
  TRANSACTION_APPROVED: { icon: 'check-circle-outline', color: '#3DDC97' },
  TRANSACTION_REJECTED: { icon: 'close-circle-outline', color: '#DC2626' },
  KYC_SUBMISSION: { icon: 'file-upload-outline', color: '#2E5FAC' },
  KYC_APPROVED: { icon: 'shield-check-outline', color: '#3DDC97' },
  KYC_REJECTED: { icon: 'shield-alert-outline', color: '#DC2626' },
  ACCOUNT_SUSPENDED: { icon: 'alert-circle-outline', color: '#DC2626' },
  ACCOUNT_REACTIVATED: { icon: 'check-circle-outline', color: '#3DDC97' },
  FRAUD_ALERT: { icon: 'alert-octagon-outline', color: '#DC2626' },
  SUPPORT_MESSAGE: { icon: 'message-alert-outline', color: '#2E5FAC' },
};

export function getNotificationMeta(type: string): NotificationMeta {
  return NOTIFICATION_META[type] ?? DEFAULT_META;
}

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const [listResult, countResult] = await Promise.all([
        notificationService.getNotifications({ limit: 50 }),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(listResult.notifications);
      setUnreadCount(countResult.count);
    } catch {
      // Leave existing state as-is; the screen that triggered this can surface its own error.
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    (async () => {
      setIsLoading(true);
      try {
        const [listResult, countResult] = await Promise.all([
          notificationService.getNotifications({ limit: 50 }),
          notificationService.getUnreadCount(),
        ]);
        if (cancelled) return;
        setNotifications(listResult.notifications);
        setUnreadCount(countResult.count);
      } catch {
        // Leave existing state as-is; the screen that triggered this can surface its own error.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Guards against a fetch started for the previous user still being in flight when
    // isAuthenticated flips (logout, or logout-then-relogin as a different user) — without
    // this, a stale response could land after the transition and overwrite the next user's
    // notifications with the previous user's data.
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const handleNewNotification = (notification: AppNotification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:new', handleNewNotification);
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [isAuthenticated]);

  const markAsRead = async (id: string) => {
    const target = notifications.find((notification) => notification.id === id);
    if (!target || target.read) return;

    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markAsRead(id);
    } catch {
      // The optimistic update stands; the next refresh() will reconcile if this failed.
    }
  };

  const value = useMemo(
    () => ({ notifications, unreadCount, isLoading, markAsRead, refresh }),
    [notifications, unreadCount, isLoading]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
