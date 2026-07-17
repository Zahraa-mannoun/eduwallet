import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { errorResponse } from '../utils/apiResponse';

// Students must complete University-Based KYC before touching financial features.
// Parents and institutions have no KYC workflow, so they're exempt.
export async function requireVerifiedKYC(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!request.authUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
    }
    if (request.authUser.userType !== 'STUDENT') {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: request.authUser.id },
      select: { kycStatus: true },
    });
    if (!user) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User no longer exists');
    }
    if (user.kycStatus !== 'VERIFIED') {
      throw new AppError(
        403,
        'KYC_REQUIRED',
        'Complete your university KYC verification to use this feature'
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      await reply.status(error.statusCode).send(errorResponse(error.message, error.code));
      return;
    }
    await reply.status(403).send(errorResponse('Forbidden', 'FORBIDDEN'));
  }
}
