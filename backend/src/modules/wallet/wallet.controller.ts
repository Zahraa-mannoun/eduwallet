import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  getTransactionsSchema,
  topUpSchema,
  transactionIdParamsSchema,
  transferSchema,
} from './wallet.schema';
import {
  getTransactionById,
  getTransactions,
  getWallet,
  topUp,
  transfer,
} from './wallet.service';

function handleWalletError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in wallet module');
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

export async function getWalletHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const wallet = await getWallet(authUser.id);
    return reply.status(200).send(successResponse(wallet));
  } catch (error) {
    return handleWalletError(request, reply, error);
  }
}

export async function topUpHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = topUpSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await topUp(authUser.id, parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWalletError(request, reply, error);
  }
}

export async function transferHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = transferSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await transfer(authUser.id, parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWalletError(request, reply, error);
  }
}

export async function getTransactionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getTransactionsSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await getTransactions(authUser.id, parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWalletError(request, reply, error);
  }
}

export async function getTransactionByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = transactionIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const transaction = await getTransactionById(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(transaction));
  } catch (error) {
    return handleWalletError(request, reply, error);
  }
}
