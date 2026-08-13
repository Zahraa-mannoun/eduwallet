import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/apiResponse';
import type { AccessTokenPayload } from '../modules/auth/auth.types';

function extractToken(request: FastifyRequest): string {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fallback for requests that can't attach a custom header at all — specifically, handing a
  // file-serving URL (a KYC document, a receipt) to Linking.openURL() so the device's own
  // browser/PDF viewer opens it directly. The access token is short-lived (15 min) and this is
  // a demonstration prototype, so accepting it in the query string here is an accepted
  // trade-off, not something every route needs — only ever used by file-preview links.
  const queryToken = (request.query as Record<string, unknown> | undefined)?.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }

  throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const token = extractToken(request);

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
