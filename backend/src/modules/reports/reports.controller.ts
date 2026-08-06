import { createReadStream } from 'fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/AppError';
import { errorResponse, successResponse } from '../../utils/apiResponse';
import { createReportRequestSchema, reportIdParamsSchema } from './reports.schema';
import {
  generateReport,
  getAllReports,
  getMyReports,
  getReportFile,
  requestReport,
} from './reports.service';

function handleReportsError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message, error.code));
  }
  request.log.error({ err: error }, 'Unexpected error in reports module');
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

export async function requestReportHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createReportRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const result = await requestReport(authUser.id, parsed.data);
    return reply.status(201).send(successResponse(result));
  } catch (error) {
    return handleReportsError(request, reply, error);
  }
}

export async function getMyReportsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authUser = requireAuthUser(request);
    const result = await getMyReports(authUser.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleReportsError(request, reply, error);
  }
}

export async function getAllReportsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAuthUser(request);
    const result = await getAllReports();
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleReportsError(request, reply, error);
  }
}

export async function generateReportHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = reportIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    requireAuthUser(request);
    const result = await generateReport(parsed.data.id);
    return reply.status(200).send(successResponse(result));
  } catch (error) {
    return handleReportsError(request, reply, error);
  }
}

export async function downloadReportHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = reportIdParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send(errorResponse(parsed.error.issues[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR'));
  }

  try {
    const authUser = requireAuthUser(request);
    const { absolutePath } = await getReportFile(authUser.id, parsed.data.id);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="report-${parsed.data.id}.pdf"`);
    return reply.send(createReadStream(absolutePath));
  } catch (error) {
    return handleReportsError(request, reply, error);
  }
}
