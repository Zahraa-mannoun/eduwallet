import { createReadStream } from 'fs';
import path from 'path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { createEmailChangeRequestSchema, emailChangeIdParamsSchema } from './email-change.schema';
import {
  approveRequest,
  getAllRequests,
  getMyRequest,
  getProofImageFile,
  rejectRequest,
  requestEmailChange,
} from './email-change.service';

const MAX_PROOF_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

function handleEmailChangeError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in email-change module');
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

export async function requestEmailChangeHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);

    let fileBuffer: Buffer | undefined;
    let uploadedFileName: string | undefined;
    let uploadedMimeType: string | undefined;
    const fields: Record<string, string> = {};

    for await (const part of request.parts({ limits: { fileSize: MAX_PROOF_FILE_SIZE_BYTES } })) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        uploadedFileName = part.filename;
        uploadedMimeType = part.mimetype;
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!fileBuffer || !uploadedFileName) {
      return reply
        .status(400)
        .send(errorResponse('Proof image is required', 'VALIDATION_ERROR'));
    }
    if (!uploadedMimeType || !ALLOWED_PROOF_MIME_TYPES.has(uploadedMimeType)) {
      return reply
        .status(400)
        .send(errorResponse('Only JPG and PNG files are accepted', 'UNSUPPORTED_FILE_TYPE'));
    }

    const parsed = createEmailChangeRequestSchema.safeParse(fields);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
    }

    const result = await requestEmailChange(
      authUser.id,
      parsed.data,
      uploadedFileName,
      fileBuffer
    );
    return reply.status(201).send(successResponse(result));
  } catch (error) {
    return handleEmailChangeError(request, reply, error);
  }
}

export async function getMyRequestHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const result = await getMyRequest(authUser.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleEmailChangeError(request, reply, error);
  }
}

export async function getAllRequestsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAuthUser(request);
    const result = await getAllRequests();
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleEmailChangeError(request, reply, error);
  }
}

export async function approveRequestHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = emailChangeIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const result = await approveRequest(parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleEmailChangeError(request, reply, error);
  }
}

export async function rejectRequestHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = emailChangeIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const result = await rejectRequest(parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleEmailChangeError(request, reply, error);
  }
}

export async function getProofImageHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = emailChangeIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const { absolutePath } = await getProofImageFile(parsed.data.id);
    const contentType = path.extname(absolutePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    reply.header('Content-Type', contentType);
    return reply.send(createReadStream(absolutePath));
  } catch (error) {
    return handleEmailChangeError(request, reply, error);
  }
}
