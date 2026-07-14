import type { Server as HTTPServer } from 'http';
import type { Notification } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import type { AccessTokenPayload } from '../auth/auth.types';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer, app: FastifyInstance): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('Missing authentication token'));
      return;
    }

    try {
      const payload = app.jwt.verify<AccessTokenPayload>(token);
      if (payload.type !== 'access') {
        next(new Error('Invalid token type'));
        return;
      }
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(userId);
  });

  return io;
}

export function emitNotification(notification: Notification): void {
  if (!io) {
    return;
  }
  io.to(notification.userId).emit('notification:new', notification);
}
