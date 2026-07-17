import { createReadStream } from 'fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { documentFileParamsSchema, reviewKYCSchema, submitKYCSchema } from './kyc.schema';
import {
  getDocumentFile,
  getKYCStatus,
  getMyDocuments,
  getPendingKYC,
  reviewKYC,
  submitDocument,
} from './kyc.service';

const MAX_KYC_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_KYC_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function isFrameworkRequestError(
  error: unknown
): error is { statusCode: number; code?: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number' &&
    (error as { statusCode: number }).statusCode < 500
  );
}

function handleKYCError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  // @fastify/multipart throws framework errors (e.g. FST_REQ_FILE_TOO_LARGE, 413) directly
  // inside the upload handler's own try/catch, so they never reach server.ts's global handler.
  if (isFrameworkRequestError(error)) {
    return reply
      .status(error.statusCode)
      .send(errorResponse(error.message, error.code ?? 'REQUEST_ERROR'));
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
  try {
    const authUser = requireAuthUser(request);

    let fileBuffer: Buffer | undefined;
    let uploadedFileName: string | undefined;
    let uploadedMimeType: string | undefined;
    const fields: Record<string, string> = {};

    for await (const part of request.parts({ limits: { fileSize: MAX_KYC_FILE_SIZE_BYTES } })) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        uploadedFileName = part.filename;
        uploadedMimeType = part.mimetype;
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!fileBuffer) {
      return reply
        .status(400)
        .send(errorResponse('No file was uploaded', 'VALIDATION_ERROR'));
    }

    if (!uploadedMimeType || !ALLOWED_KYC_MIME_TYPES.has(uploadedMimeType)) {
      return reply
        .status(400)
        .send(errorResponse('Only JPG, PNG, and PDF files are accepted', 'UNSUPPORTED_FILE_TYPE'));
    }

    const parsed = submitKYCSchema.safeParse({
      documentType: fields.documentType,
      fileName: fields.fileName ?? uploadedFileName,
      fileType: fields.fileType ?? uploadedMimeType,
    });
    if (!parsed.success) {
      return reply
        .status(400)
        .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
    }

    const document = await submitDocument(authUser.id, parsed.data, fileBuffer);
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

export async function getDocumentFileHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = documentFileParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const { document, absolutePath } = await getDocumentFile(parsed.data.documentId);
    const safeFileName = document.fileName.replaceAll('"', '');
    reply.header('Content-Type', document.fileType ?? 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${safeFileName}"`);
    return reply.send(createReadStream(absolutePath));
  } catch (error) {
    return handleKYCError(request, reply, error);
  }
}
