import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  documentIdParamsSchema,
  hashParamsSchema,
  uploadDocumentSchema,
  verifyDocumentSchema,
} from './blockchain.schema';
import {
  getDocumentById,
  getMyDocuments,
  uploadDocument,
  verifyDocument,
} from './blockchain.service';

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

function handleBlockchainError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
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
  request.log.error({ err: error }, 'Unexpected error in blockchain module');
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

export async function uploadDocumentHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);

    let fileBuffer: Buffer | undefined;
    let uploadedFileName: string | undefined;
    let uploadedMimeType: string | undefined;
    const fields: Record<string, string> = {};

    for await (const part of request.parts()) {
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

    const parsed = uploadDocumentSchema.safeParse({
      fileName: fields.fileName ?? uploadedFileName,
      fileType: fields.fileType ?? uploadedMimeType,
      documentName: fields.documentName,
      documentType: fields.documentType,
    });
    if (!parsed.success) {
      return reply
        .status(400)
        .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
    }

    const document = await uploadDocument(authUser.id, parsed.data, fileBuffer);
    return reply.status(201).send(successResponse(document));
  } catch (error) {
    return handleBlockchainError(request, reply, error);
  }
}

export async function getMyDocumentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const documents = await getMyDocuments(authUser.id);
    return reply.status(200).send(successResponse(documents));
  } catch (error) {
    return handleBlockchainError(request, reply, error);
  }
}

export async function getDocumentByIdHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = documentIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const document = await getDocumentById(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(document));
  } catch (error) {
    return handleBlockchainError(request, reply, error);
  }
}

export async function verifyDocumentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = verifyDocumentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await verifyDocument(parsed.data.hash);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleBlockchainError(request, reply, error);
  }
}

export async function verifyByHashParamHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = hashParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const result = await verifyDocument(parsed.data.hash);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleBlockchainError(request, reply, error);
  }
}
