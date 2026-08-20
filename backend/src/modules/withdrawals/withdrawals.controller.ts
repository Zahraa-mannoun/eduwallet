import { createReadStream } from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import {
  lookupStudentQuerySchema,
  processWithdrawalSchema,
  rejectWithdrawalSchema,
  studentIdParamsSchema,
  verifyReceiptSchema,
  withdrawalIdParamsSchema,
} from './withdrawals.schema';
import {
  approveWithdrawal,
  completeWithdrawal,
  deleteReceipt,
  getAllWithdrawals,
  getAllWithdrawalsForAdmin,
  getPendingApprovalsForParent,
  getReceiptFile,
  getWithdrawalsForParent,
  getWithdrawalsForStudent,
  listVerifiedStudents,
  lookupStudent,
  processWithdrawal,
  rejectWithdrawal,
  uploadReceipt,
  verifyReceipt,
} from './withdrawals.service';

const MAX_RECEIPT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

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

function handleWithdrawalsError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  if (isFrameworkRequestError(error)) {
    return reply
      .status(error.statusCode)
      .send(errorResponse(error.message, error.code ?? 'REQUEST_ERROR'));
  }
  request.log.error({ err: error }, 'Unexpected error in withdrawals module');
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

export async function getAllWithdrawalsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAuthUser(request);
    const withdrawals = await getAllWithdrawals();
    return reply.status(200).send(successResponse(withdrawals));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function getMyWithdrawalsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const withdrawals = await getWithdrawalsForStudent(authUser.id);
    return reply.status(200).send(successResponse(withdrawals));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function getPendingApprovalsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const withdrawals = await getPendingApprovalsForParent(authUser.id);
    return reply.status(200).send(successResponse(withdrawals));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function lookupStudentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = lookupStudentQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const result = await lookupStudent(parsed.data.query);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function listVerifiedStudentsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAuthUser(request);
    const students = await listVerifiedStudents();
    return reply.status(200).send(successResponse(students));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function processWithdrawalHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = processWithdrawalSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await processWithdrawal(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function approveWithdrawalHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = withdrawalIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await approveWithdrawal(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function rejectWithdrawalHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = withdrawalIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = rejectWithdrawalSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await rejectWithdrawal(authUser.id, paramsParsed.data.id, bodyParsed.data.reason);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function completeWithdrawalHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = withdrawalIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await completeWithdrawal(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function uploadReceiptHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = withdrawalIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  try {
    const authUser = requireAuthUser(request);

    let fileBuffer: Buffer | undefined;
    let uploadedFileName: string | undefined;
    let uploadedMimeType: string | undefined;
    const fields: Record<string, string> = {};

    for await (const part of request.parts({ limits: { fileSize: MAX_RECEIPT_FILE_SIZE_BYTES } })) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        uploadedFileName = part.filename;
        uploadedMimeType = part.mimetype;
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!fileBuffer || !uploadedFileName) {
      return reply.status(400).send(errorResponse('No file was uploaded', 'VALIDATION_ERROR'));
    }
    if (!uploadedMimeType || !ALLOWED_RECEIPT_MIME_TYPES.has(uploadedMimeType)) {
      return reply
        .status(400)
        .send(errorResponse('Only JPG and PNG files are accepted', 'UNSUPPORTED_FILE_TYPE'));
    }

    const result = await uploadReceipt(
      authUser.id,
      paramsParsed.data.id,
      uploadedFileName,
      fileBuffer,
      fields.merchantName?.trim() || undefined
    );
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function deleteReceiptHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = withdrawalIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await deleteReceipt(authUser.id, parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function getAllWithdrawalsForAdminHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    requireAuthUser(request);
    const withdrawals = await getAllWithdrawalsForAdmin();
    return reply.status(200).send(successResponse(withdrawals));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function getReceiptFileHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = withdrawalIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const { request: withdrawal, absolutePath } = await getReceiptFile(parsed.data.id, authUser);
    const contentType = absolutePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `inline; filename="receipt-${withdrawal.id}"`);
    return reply.send(createReadStream(absolutePath));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function getWithdrawalsForParentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = studentIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const withdrawals = await getWithdrawalsForParent(authUser.id, parsed.data.studentId);
    return reply.status(200).send(successResponse(withdrawals));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}

export async function verifyReceiptHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = withdrawalIdParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send(
        errorResponse(paramsParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR')
      );
  }

  const bodyParsed = verifyReceiptSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send(errorResponse(bodyParsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const result = await verifyReceipt(
      paramsParsed.data.id,
      bodyParsed.data.decision,
      bodyParsed.data.note
    );
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleWithdrawalsError(request, reply, error);
  }
}
