import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { getPendingKYC } from '../kyc/kyc.service';
import {
  addFundsParamsSchema,
  addFundsSchema,
  agentIdParamsSchema,
  createAgentSchema,
  deactivateAgentSchema,
  fraudAlertIdParamsSchema,
  getAllTransactionsSchema,
  getFraudAlertsSchema,
  getUsersSchema,
  notifyAgentSchema,
  resolveFraudAlertSchema,
  suspendUserSchema,
  userIdParamsSchema,
} from './admin.schema';
import {
  addFunds,
  createAgent,
  deactivateAgent,
  getAgents,
  getAllTransactions,
  getAnalytics,
  getAuditLog,
  getFraudAlerts,
  getRelationships,
  getSystemStats,
  getUserById,
  getUsers,
  reactivateAgent,
  resolveFraudAlert,
  sendAgentNotification,
  suspendUser,
  unsuspendUser,
} from './admin.service';

function handleAdminError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in admin module');
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

export async function getStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const stats = await getSystemStats();
    return reply.status(200).send(successResponse(stats));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getUsersHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getUsersSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await getUsers(parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getUserByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = userIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await getUserById(parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function suspendUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = userIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = suspendUserSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const user = await suspendUser(authUser.id, paramsParsed.data.id, bodyParsed.data.reason);
    return reply.status(200).send(successResponse(user));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function unsuspendUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = userIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const user = await unsuspendUser(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(user));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getAllTransactionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getAllTransactionsSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await getAllTransactions(parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getFraudAlertsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getFraudAlertsSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const alerts = await getFraudAlerts(parsed.data.resolved);
    return reply.status(200).send(successResponse(alerts));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function resolveFraudAlertHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = fraudAlertIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = resolveFraudAlertSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const alert = await resolveFraudAlert(
      authUser.id,
      paramsParsed.data.id,
      bodyParsed.data.note
    );
    return reply.status(200).send(successResponse(alert));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getPendingKYCHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const users = await getPendingKYC();
    return reply.status(200).send(successResponse(users));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getAuditLogHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const log = await getAuditLog();
    return reply.status(200).send(successResponse(log));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function addFundsHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = addFundsParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = addFundsSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const wallet = await addFunds(authUser.id, paramsParsed.data.userId, bodyParsed.data);
    return reply.status(200).send(successResponse(wallet));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getRelationshipsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const relationships = await getRelationships();
    return reply.status(200).send(successResponse(relationships));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const analytics = await getAnalytics();
    return reply.status(200).send(successResponse(analytics));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function createAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createAgentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const agent = await createAgent(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(agent));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function getAgentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const agents = await getAgents();
    return reply.status(200).send(successResponse(agents));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function deactivateAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = agentIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = deactivateAgentSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const agent = await deactivateAgent(authUser.id, paramsParsed.data.id, bodyParsed.data.reason);
    return reply.status(200).send(successResponse(agent));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function notifyAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = agentIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = notifyAgentSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    await sendAgentNotification(authUser.id, paramsParsed.data.id, bodyParsed.data.message);
    return reply.status(200).send(successResponse({ message: 'Notification sent' }));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}

export async function reactivateAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const agent = await reactivateAgent(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(agent));
  } catch (error) {
    return handleAdminError(request, reply, error);
  }
}
