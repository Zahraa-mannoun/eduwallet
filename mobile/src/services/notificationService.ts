import type { Notification } from '../types/api';
import { apiRequest } from './api';

export type GetNotificationsParams = {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
};

export async function getNotifications(
  params: GetNotificationsParams = {}
): Promise<{ notifications: Notification[]; total: number; page: number; limit: number }> {
  return apiRequest('/notifications', { query: params });
}

export async function markAsRead(id: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllAsRead(): Promise<{ count: number }> {
  return apiRequest('/notifications/read-all', { method: 'PATCH' });
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return apiRequest('/notifications/unread-count');
}

export async function deleteNotification(id: string): Promise<{ message: string }> {
  return apiRequest(`/notifications/${id}`, { method: 'DELETE' });
}
