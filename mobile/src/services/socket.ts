import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';
import type { Notification } from '../types/api';

let socket: Socket | null = null;

type NotificationListener = (notification: Notification) => void;
// Every subscriber (NotificationsContext's own bell-badge listener, plus every screen using
// useNotificationRefetch) lives in this one Set and gets re-attached to whatever socket
// connectSocket() creates next — a single-listener design would silently drop every screen's
// subscription but one across a reconnect (token refresh, app resume), which only never showed
// up before because NotificationsContext used to be the only subscriber that ever existed.
const notificationListeners = new Set<NotificationListener>();

function attachListeners(target: Socket): void {
  notificationListeners.forEach((listener) => target.on('notification:new', listener));
}

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }
  // WebSocket only — the client default (['polling', 'websocket']) starts every connection
  // over HTTP long-polling and only upgrades to WebSocket afterward, adding a full request
  // round-trip of latency before the server can join this socket to its notification room.
  socket = io(API_BASE_URL, { auth: { token }, transports: ['websocket'] });
  attachListeners(socket);
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

// Registers a listener for every notification:new event, on the current socket immediately (or,
// if the socket hasn't been created yet, as soon as connectSocket() creates one) — no window
// where an event could arrive before this listener is in place. Any number of callers may
// subscribe concurrently (NotificationsContext plus every screen using useNotificationRefetch).
export function subscribeToNotifications(listener: NotificationListener): () => void {
  notificationListeners.add(listener);
  socket?.on('notification:new', listener);

  return () => {
    notificationListeners.delete(listener);
    socket?.off('notification:new', listener);
  };
}
