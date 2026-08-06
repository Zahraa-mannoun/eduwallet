import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { prepareDisbursementSchema } from './university.schema';
import { getVerifiedUniversityStudents, prepareDisbursement } from './university.service';

function handleUniversityError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in university module');
  return reply
    .status(500)
    .send(errorResponse('Something went wrong. Please try again.', 'INTERNAL_ERROR'));
}

export async function getVerifiedUniversityStudentsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const students = await getVerifiedUniversityStudents();
    return reply.status(200).send(successResponse(students));
  } catch (error) {
    return handleUniversityError(request, reply, error);
  }
}

export async function prepareDisbursementHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = prepareDisbursementSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const preview = await prepareDisbursement(parsed.data);
    return reply.status(200).send(successResponse(preview));
  } catch (error) {
    return handleUniversityError(request, reply, error);
  }
}
