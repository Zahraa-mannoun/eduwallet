import type { UserType } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/apiResponse';

export function requireRole(...allowedTypes: UserType[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!request.authUser) {
        throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
      }
      if (!allowedTypes.includes(request.authUser.userType)) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'You do not have permission to access this resource'
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        await reply.status(error.statusCode).send(errorResponse(error.message, error.code));
        return;
      }
      await reply.status(403).send(errorResponse('Forbidden', 'FORBIDDEN'));
    }
  };
}
