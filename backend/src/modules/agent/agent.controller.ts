import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { sendAgentMessageSchema } from './agent.schema';
import { getAgentStats, getMyAgentMessages, sendAgentMessage } from './agent.service';

function handleAgentError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in agent module');
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

export async function getAgentStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const stats = await getAgentStats(authUser.id);
    return reply.status(200).send(successResponse(stats));
  } catch (error) {
    return handleAgentError(request, reply, error);
  }
}

export async function sendAgentMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = sendAgentMessageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const message = await sendAgentMessage(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(message));
  } catch (error) {
    return handleAgentError(request, reply, error);
  }
}

export async function getMyAgentMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const messages = await getMyAgentMessages(authUser.id);
    return reply.status(200).send(successResponse(messages));
  } catch (error) {
    return handleAgentError(request, reply, error);
  }
}
