import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/apiResponse';
import type { AccessTokenPayload } from '../modules/auth/auth.types';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
    }
    const token = authHeader.slice(7);

    let payload: AccessTokenPayload;
    try {
      payload = request.server.jwt.verify<AccessTokenPayload>(token);
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired access token');
    }

    if (payload.type !== 'access') {
      throw new AppError(401, 'INVALID_TOKEN', 'Token is not an access token');
    }

    const isBlacklisted = await redis.get(`auth:blacklist:${token}`);
    if (isBlacklisted) {
      throw new AppError(401, 'TOKEN_REVOKED', 'This token has been revoked');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User no longer exists');
    }
    if (user.suspended) {
      // Matches loginUser()'s suspended check (auth.service.ts) — the actual reason, not a
      // generic message, so a client mid-session (e.g. LoginScreen after being bounced back
      // by AuthContext) can show the same "Reason: ..." text a suspended login attempt would.
      throw new AppError(
        401,
        'ACCOUNT_SUSPENDED',
        user.suspensionReason ?? 'This account has been suspended.'
      );
    }

    request.authUser = { id: payload.sub, email: payload.email, userType: payload.userType };
  } catch (error) {
    if (error instanceof AppError) {
      await reply.status(error.statusCode).send(errorResponse(error.message, error.code));
      return;
    }
    await reply.status(401).send(errorResponse('Authentication failed', 'UNAUTHORIZED'));
  }
}
