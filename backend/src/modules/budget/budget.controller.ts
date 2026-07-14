import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  categoryParamsSchema,
  monthQuerySchema,
  setBudgetSchema,
  updateBudgetSchema,
} from './budget.schema';
import {
  deleteBudget,
  getBudgetSummary,
  getBudgets,
  getCurrentMonth,
  setBudget,
  updateBudget,
} from './budget.service';

function handleBudgetError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in budget module');
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

export async function setBudgetHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = setBudgetSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const budget = await setBudget(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(budget));
  } catch (error) {
    return handleBudgetError(request, reply, error);
  }
}

export async function getBudgetsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = monthQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const month = parsed.data.month ?? getCurrentMonth();
    const budgets = await getBudgets(authUser.id, month);
    return reply.status(200).send(successResponse({ month, budgets }));
  } catch (error) {
    return handleBudgetError(request, reply, error);
  }
}

export async function updateBudgetHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = categoryParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const queryParsed = monthQuerySchema.safeParse(request.query);
  if (!queryParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(queryParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = updateBudgetSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const month = queryParsed.data.month ?? getCurrentMonth();
    const budget = await updateBudget(
      authUser.id,
      paramsParsed.data.category,
      month,
      bodyParsed.data
    );
    return reply.status(200).send(successResponse(budget));
  } catch (error) {
    return handleBudgetError(request, reply, error);
  }
}

export async function deleteBudgetHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = categoryParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const queryParsed = monthQuerySchema.safeParse(request.query);
  if (!queryParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(queryParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const month = queryParsed.data.month ?? getCurrentMonth();
    await deleteBudget(authUser.id, paramsParsed.data.category, month);
    return reply.status(200).send(successResponse({ message: 'Budget deleted successfully' }));
  } catch (error) {
    return handleBudgetError(request, reply, error);
  }
}

export async function getBudgetSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = monthQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const month = parsed.data.month ?? getCurrentMonth();
    const summary = await getBudgetSummary(authUser.id, month);
    return reply.status(200).send(successResponse(summary));
  } catch (error) {
    return handleBudgetError(request, reply, error);
  }
}
