import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';
import type { Notification } from '../types/api';

let socket: Socket | null = null;

type NotificationListener = (notification: Notification) => void;
// Set by subscribeToNotifications() and re-attached to every socket connectSocket() creates —
// this is what guarantees the listener exists at (or before) connection time instead of racing
// a separate effect that has to wait for a render to notice the socket exists. Without this, a
// notification emitted in the brief window between io() returning and some later consumer
// calling getSocket() could be missed entirely.
let notificationListener: NotificationListener | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }
  // WebSocket only — the client default (['polling', 'websocket']) starts every connection
  // over HTTP long-polling and only upgrades to WebSocket afterward, adding a full request
  // round-trip of latency before the server can join this socket to its notification room.
  socket = io(API_BASE_URL, { auth: { token }, transports: ['websocket'] });
  if (notificationListener) {
    socket.on('notification:new', notificationListener);
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

// The app's single notification listener, registered once here rather than pulled reactively
// via getSocket() from a separate effect — attaches immediately if a socket already exists,
// and connectSocket() re-attaches it to every socket created afterward (e.g. a fresh login),
// so it's never possible for a socket to be connected without this listener already on it.
export function subscribeToNotifications(listener: NotificationListener): () => void {
  notificationListener = listener;
  socket?.on('notification:new', listener);

  return () => {
    socket?.off('notification:new', listener);
    if (notificationListener === listener) {
      notificationListener = null;
    }
  };
}
