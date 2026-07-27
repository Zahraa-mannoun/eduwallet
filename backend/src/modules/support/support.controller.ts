import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { sendSupportMessageSchema, supportMessageIdParamsSchema } from './support.schema';
import { getSupportMessages, markSupportMessageRead, sendSupportMessage } from './support.service';

function handleSupportError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in support module');
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

export async function sendSupportMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = sendSupportMessageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    // Public route — no request.authUser here, the email in the body identifies the sender.
    const message = await sendSupportMessage(parsed.data);
    return reply.status(201).send(successResponse(message));
  } catch (error) {
    return handleSupportError(request, reply, error);
  }
}

export async function getSupportMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAuthUser(request);
    const messages = await getSupportMessages();
    return reply.status(200).send(successResponse(messages));
  } catch (error) {
    return handleSupportError(request, reply, error);
  }
}

export async function markSupportMessageReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = supportMessageIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const message = await markSupportMessageRead(parsed.data.id);
    return reply.status(200).send(successResponse(message));
  } catch (error) {
    return handleSupportError(request, reply, error);
  }
}
