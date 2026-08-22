import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { aiChatSchema } from './ai.schema';
import { getAIChatReply, getAIInsights } from './ai.service';

function handleAIError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in AI module');
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

export async function getAIInsightsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const insights = await getAIInsights(authUser.id);
    return reply.status(200).send(successResponse(insights));
  } catch (error) {
    return handleAIError(request, reply, error);
  }
}

export async function aiChatHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = aiChatSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const reply_ = await getAIChatReply(authUser.id, parsed.data.message, parsed.data.history);
    return reply.status(200).send(successResponse({ reply: reply_ }));
  } catch (error) {
    return handleAIError(request, reply, error);
  }
}
