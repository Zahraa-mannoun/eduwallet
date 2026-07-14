import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  approveTransactionSchema,
  linkStudentSchema,
  rejectTransactionSchema,
  studentIdParamsSchema,
  updateSettingsSchema,
} from './parental.schema';
import {
  approveTransaction,
  getLinkedStudents,
  getPendingApprovals,
  linkStudent,
  rejectTransaction,
  unlinkStudent,
  updateSettings,
} from './parental.service';

function handleParentalError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in parental module');
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

export async function linkStudentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = linkStudentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const link = await linkStudent(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(link));
  } catch (error) {
    return handleParentalError(request, reply, error);
  }
}

export async function unlinkStudentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = studentIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    await unlinkStudent(authUser.id, parsed.data.studentId);
    return reply.status(200).send(successResponse({ message: 'Student unlinked successfully' }));
  } catch (error) {
    return handleParentalError(request, reply, error);
  }
}

export async function updateSettingsHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = studentIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = updateSettingsSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const link = await updateSettings(authUser.id, paramsParsed.data.studentId, bodyParsed.data);
    return reply.status(200).send(successResponse(link));
  } catch (error) {
    return handleParentalError(request, reply, error);
  }
}

export async function getPendingApprovalsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const transactions = await getPendingApprovals(authUser.id);
    return reply.status(200).send(successResponse(transactions));
  } catch (error) {
    return handleParentalError(request, reply, error);
  }
}

export async function approveTransactionHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = approveTransactionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const transaction = await approveTransaction(authUser.id, parsed.data.transactionId);
    return reply.status(200).send(successResponse(transaction));
  } catch (error) {
    return handleParentalError(request, reply, error);
  }
}

export async function rejectTransactionHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = rejectTransactionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const transaction = await rejectTransaction(
      authUser.id,
      parsed.data.transactionId,
      parsed.data.reason
    );
    return reply.status(200).send(successResponse(transaction));
  } catch (error) {
    return handleParentalError(request, reply, error);
  }
}

export async function getLinkedStudentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const students = await getLinkedStudents(authUser.id);
    return reply.status(200).send(successResponse(students));
  } catch (error) {
    return handleParentalError(request, reply, error);
  }
}
