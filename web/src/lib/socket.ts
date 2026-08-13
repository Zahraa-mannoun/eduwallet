import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { tokenStorage } from './api';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;
let subscriberCount = 0;

function ensureSocket(): Socket | null {
  const token = tokenStorage.getAccessToken();
  if (!token) return null;
  if (!socket) {
    // WebSocket only — matches the mobile client's own connectSocket() (mobile's
    // services/socket.ts), skipping the long-polling-then-upgrade round trip the client's
    // default transport list would otherwise add before the server can join this socket to its
    // notification room.
    socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    socket.on('connect_error', (err) => {
      console.error('[socket] connection error', err.message);
    });
  }
  return socket;
}

// Reference-counted so the connection survives page-to-page navigation inside the SPA (every
// page's useSocketRefetch calls this on mount) instead of tearing down and reconnecting on every
// route change, while still closing cleanly once nothing is listening anymore.
export function acquireSocket(): Socket | null {
  subscriberCount += 1;
  return ensureSocket();
}

export function releaseSocket(): void {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

// Called from AuthContext's logout(). Logout here is a plain client-side state change, not a
// full page reload, so without this the socket would otherwise keep running under the
// just-cleared token until something else happened to unmount the last subscriber.
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  subscriberCount = 0;
}
