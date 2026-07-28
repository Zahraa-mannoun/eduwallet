import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateAdminCredentialsSchema,
} from './auth.schema';
import {
  changePassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAdminCredentials,
} from './auth.service';

function handleAuthError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in auth module');
  return reply
    .status(500)
    .send(errorResponse('Something went wrong. Please try again.', 'INTERNAL_ERROR'));
}

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const user = await registerUser(parsed.data);
    return reply.status(201).send(successResponse(user));
  } catch (error) {
    return handleAuthError(request, reply, error);
  }
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await loginUser(request.server, parsed.data);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleAuthError(request, reply, error);
  }
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token || !request.authUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
    }

    await logoutUser(request.server, token, request.authUser.id);
    return reply.status(200).send(successResponse({ message: 'Logged out successfully' }));
  } catch (error) {
    return handleAuthError(request, reply, error);
  }
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = refreshSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await refreshAccessToken(request.server, parsed.data.refreshToken);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleAuthError(request, reply, error);
  }
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!request.authUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
    }
    const user = await getCurrentUser(request.authUser.id);
    return reply.status(200).send(successResponse(user));
  } catch (error) {
    return handleAuthError(request, reply, error);
  }
}

export async function changePasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = changePasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    if (!request.authUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
    }
    const user = await changePassword(request.authUser.id, parsed.data);
    return reply.status(200).send(successResponse(user));
  } catch (error) {
    return handleAuthError(request, reply, error);
  }
}

export async function updateAdminCredentialsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateAdminCredentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    if (!request.authUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing authentication');
    }
    const user = await updateAdminCredentials(request.authUser.id, parsed.data);
    return reply.status(200).send(successResponse(user));
  } catch (error) {
    return handleAuthError(request, reply, error);
  }
}
