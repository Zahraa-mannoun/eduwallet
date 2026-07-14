import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }
  socket = io(API_BASE_URL, { auth: { token } });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
