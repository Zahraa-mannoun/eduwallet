import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  rejectWithdrawalSchema,
  requestWithdrawalSchema,
  withdrawalRequestIdParamsSchema,
} from './savings.schema';
import {
  approveWithdrawal,
  getMySavings,
  getWithdrawalRequests,
  rejectWithdrawal,
  requestWithdrawal,
  runRollover,
} from './savings.service';

function handleSavingsError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in savings module');
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

export async function getMySavingsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const savings = await getMySavings(authUser.id);
    return reply.status(200).send(successResponse(savings));
  } catch (error) {
    return handleSavingsError(request, reply, error);
  }
}

export async function requestWithdrawalHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = requestWithdrawalSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await requestWithdrawal(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(result));
  } catch (error) {
    return handleSavingsError(request, reply, error);
  }
}

export async function getWithdrawalRequestsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const requests = await getWithdrawalRequests(authUser.id);
    return reply.status(200).send(successResponse(requests));
  } catch (error) {
    return handleSavingsError(request, reply, error);
  }
}

export async function approveWithdrawalHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = withdrawalRequestIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await approveWithdrawal(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleSavingsError(request, reply, error);
  }
}

export async function rejectWithdrawalHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = withdrawalRequestIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = rejectWithdrawalSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await rejectWithdrawal(authUser.id, paramsParsed.data.id, bodyParsed.data.reason);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleSavingsError(request, reply, error);
  }
}

export async function runRolloverHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await runRollover();
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleSavingsError(request, reply, error);
  }
}
