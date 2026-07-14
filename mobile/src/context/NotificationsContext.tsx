import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type NotificationType =
  | 'PAYMENT_RECEIVED'
  | 'APPROVAL_NEEDED'
  | 'BUDGET_ALERT'
  | 'BLOCKCHAIN_VERIFIED';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
};

export const NOTIFICATION_META: Record<
  NotificationType,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }
> = {
  PAYMENT_RECEIVED: { icon: 'cash-plus', color: '#3DDC97' },
  APPROVAL_NEEDED: { icon: 'clock-alert-outline', color: '#F59E0B' },
  BUDGET_ALERT: { icon: 'alert-circle-outline', color: '#DC2626' },
  BLOCKCHAIN_VERIFIED: { icon: 'shield-check-outline', color: '#2E5FAC' },
};

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NTF-1',
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: 'You received $200.00 from Mom & Dad.',
    timestamp: '2026-07-13T18:02:00',
    read: false,
  },
  {
    id: 'NTF-2',
    type: 'APPROVAL_NEEDED',
    title: 'Approval Needed',
    message: 'Your $120.00 payment to Tech Store needs parent approval.',
    timestamp: '2026-07-12T14:46:00',
    read: false,
  },
  {
    id: 'NTF-3',
    type: 'BUDGET_ALERT',
    title: 'Budget Alert',
    message: "You're close to your Food budget limit this month.",
    timestamp: '2026-07-11T09:20:00',
    read: false,
  },
  {
    id: 'NTF-4',
    type: 'BLOCKCHAIN_VERIFIED',
    title: 'Document Verified',
    message: 'Your Enrollment Certificate hash was verified on the blockchain.',
    timestamp: '2026-07-09T16:10:00',
    read: true,
  },
];

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const value = useMemo(
    () => ({ notifications, unreadCount, markAsRead }),
    [notifications, unreadCount]
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
