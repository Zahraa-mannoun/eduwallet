import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { bulkDisburseSchema } from './scholarship.schema';
import { bulkDisburse, getStudents } from './scholarship.service';

function handleScholarshipError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in scholarship module');
  return reply
    .status(500)
    .send(errorResponse('Something went wrong. Please try again.', 'INTERNAL_ERROR'));
}

function requireAuthUser(request: FastifyRequest) {
  if (!request.authUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
  }
  return request.authUser;
}

export async function getStudentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAuthUser(request);
    const students = await getStudents();
    return reply.status(200).send(successResponse(students));
  } catch (error) {
    return handleScholarshipError(request, reply, error);
  }
}

export async function bulkDisburseHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = bulkDisburseSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await bulkDisburse(authUser.id, parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleScholarshipError(request, reply, error);
  }
}
