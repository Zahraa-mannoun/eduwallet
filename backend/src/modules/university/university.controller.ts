import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  disburseSelectedSchema,
  fundIndividualSchema,
  prepareDisbursementSchema,
  selectStudentsSchema,
} from './university.schema';
import {
  disburseSelected,
  fundIndividual,
  getSelectedStudents,
  getVerifiedUniversityStudents,
  prepareDisbursement,
  selectStudents,
} from './university.service';

function handleUniversityError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in university module');
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

export async function selectStudentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = selectStudentsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await selectStudents(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(result));
  } catch (error) {
    return handleUniversityError(request, reply, error);
  }
}

export async function getSelectedStudentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const result = await getSelectedStudents(authUser.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleUniversityError(request, reply, error);
  }
}

export async function disburseSelectedHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = disburseSelectedSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await disburseSelected(authUser.id, parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleUniversityError(request, reply, error);
  }
}

export async function fundIndividualHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = fundIndividualSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await fundIndividual(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(result));
  } catch (error) {
    return handleUniversityError(request, reply, error);
  }
}
