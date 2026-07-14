import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { reviewKYCSchema, submitKYCSchema } from './kyc.schema';
import {
  getKYCStatus,
  getMyDocuments,
  getPendingKYC,
  reviewKYC,
  submitDocument,
} from './kyc.service';

function handleKYCError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in KYC module');
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

export async function submitDocumentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = submitKYCSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const document = await submitDocument(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(document));
  } catch (error) {
    return handleKYCError(request, reply, error);
  }
}

export async function getKYCStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const status = await getKYCStatus(authUser.id);
    return reply.status(200).send(successResponse(status));
  } catch (error) {
    return handleKYCError(request, reply, error);
  }
}

export async function getMyDocumentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const documents = await getMyDocuments(authUser.id);
    return reply.status(200).send(successResponse(documents));
  } catch (error) {
    return handleKYCError(request, reply, error);
  }
}

export async function reviewKYCHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = reviewKYCSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const student = await reviewKYC(authUser.id, parsed.data);
    return reply.status(200).send(successResponse(student));
  } catch (error) {
    return handleKYCError(request, reply, error);
  }
}

export async function getPendingKYCHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAuthUser(request);
    const users = await getPendingKYC();
    return reply.status(200).send(successResponse(users));
  } catch (error) {
    return handleKYCError(request, reply, error);
  }
}
