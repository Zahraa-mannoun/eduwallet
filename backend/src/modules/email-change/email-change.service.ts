import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { EmailChangeRequest, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { isUniqueConstraintError } from '../../utils/prismaErrors';
import { revokeRefreshToken } from '../auth/auth.service';
import { createNotification } from '../notifications/notifications.service';
import type { CreateEmailChangeRequestInput } from './email-change.schema';

// backend/src/modules/email-change -> backend (three levels up), same resolution used by
// kyc.service.ts's UPLOADS_ROOT and withdrawals.service.ts's UPLOADS_ROOT.
const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads', 'email-change');

export type EmailChangeRequestRow = EmailChangeRequest & {
  user: { id: string; fullName: string; email: string; userType: string };
};

const requestInclude = {
  user: { select: { id: true, fullName: true, email: true, userType: true } },
} satisfies Prisma.EmailChangeRequestInclude;

export async function requestEmailChange(
  userId: string,
  input: CreateEmailChangeRequestInput,
  fileName: string,
  fileBuffer: Buffer
): Promise<EmailChangeRequestRow> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (input.requestedEmail === user.email) {
    throw new AppError(
      400,
      'SAME_EMAIL',
      'The requested email is the same as your current email'
    );
  }

  const emailTaken = await prisma.user.findUnique({ where: { email: input.requestedEmail } });
  if (emailTaken) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const existingPending = await prisma.emailChangeRequest.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (existingPending) {
    throw new AppError(
      409,
      'REQUEST_ALREADY_PENDING',
      'You already have a pending email change request'
    );
  }

  const userDir = path.join(UPLOADS_ROOT, userId);
  await fs.mkdir(userDir, { recursive: true });
  const storedFileName = `${randomUUID()}${path.extname(fileName)}`;
  const absoluteFilePath = path.join(userDir, storedFileName);
  await fs.writeFile(absoluteFilePath, fileBuffer);
  const proofImagePath = path.relative(BACKEND_ROOT, absoluteFilePath);

  let request: EmailChangeRequestRow;
  try {
    // The findFirst check above is a fast-path only — it can't stop two concurrent
    // submissions from both passing it before either writes. The database-level partial
    // unique index (email_change_requests_one_pending_per_user — see migration
    // 20260807120000) is what actually closes that race: a second concurrent create() for
    // the same still-PENDING user fails with a unique constraint violation, caught below.
    request = await prisma.$transaction(async (tx) =>
      tx.emailChangeRequest.create({
        data: {
          userId,
          currentEmail: user.email,
          requestedEmail: input.requestedEmail,
          reason: input.reason,
          proofImagePath,
        },
        include: requestInclude,
      })
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        409,
        'REQUEST_ALREADY_PENDING',
        'You already have a pending email change request'
      );
    }
    throw error;
  }

  const admins = await prisma.user.findMany({ where: { userType: 'ADMIN' }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        admin.id,
        'Email Change Requested',
        `${user.fullName} has requested an email change from ${user.email} to ${input.requestedEmail}.`,
        'EMAIL_CHANGE_REQUESTED'
      )
    )
  );

  return request;
}

export async function getMyRequest(userId: string): Promise<EmailChangeRequestRow | null> {
  return prisma.emailChangeRequest.findFirst({
    where: { userId },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllRequests(): Promise<{
  pending: EmailChangeRequestRow[];
  accepted: EmailChangeRequestRow[];
}> {
  const [pending, accepted] = await Promise.all([
    prisma.emailChangeRequest.findMany({
      where: { status: 'PENDING' },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.emailChangeRequest.findMany({
      where: { status: 'ACCEPTED' },
      include: requestInclude,
      orderBy: { resolvedAt: 'desc' },
    }),
  ]);

  return { pending, accepted };
}

async function getPendingRequestOrThrow(requestId: string): Promise<EmailChangeRequestRow> {
  const request = await prisma.emailChangeRequest.findUnique({
    where: { id: requestId },
    include: requestInclude,
  });
  if (!request) {
    throw new AppError(404, 'REQUEST_NOT_FOUND', 'Email change request not found');
  }
  if (request.status !== 'PENDING') {
    throw new AppError(400, 'REQUEST_ALREADY_RESOLVED', 'This request has already been resolved');
  }
  return request;
}

export async function approveRequest(requestId: string): Promise<EmailChangeRequest> {
  const request = await getPendingRequestOrThrow(requestId);

  const user = await prisma.user.findUnique({ where: { id: request.userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  // Guards against approving a request whose currentEmail snapshot is now stale — e.g. a
  // second once-concurrent PENDING request for the same user (see requestEmailChange's
  // race-closing unique index) that was created against an email that has since changed.
  if (request.currentEmail !== user.email) {
    throw new AppError(
      409,
      'REQUEST_STALE',
      "This request no longer matches the user's current email and can't be approved"
    );
  }

  const emailTaken = await prisma.user.findUnique({ where: { email: request.requestedEmail } });
  if (emailTaken) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const [, updatedRequest] = await prisma.$transaction([
    prisma.user.update({ where: { id: request.userId }, data: { email: request.requestedEmail } }),
    prisma.emailChangeRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', resolvedAt: new Date() },
    }),
  ]);

  await revokeRefreshToken(request.userId);

  await createNotification(
    request.userId,
    'Email Change Approved',
    `Your email change request has been approved. Please log in with your new email: ${request.requestedEmail}`,
    'EMAIL_CHANGE_APPROVED'
  );

  return updatedRequest;
}

export async function rejectRequest(requestId: string): Promise<EmailChangeRequest> {
  const request = await getPendingRequestOrThrow(requestId);

  const updated = await prisma.emailChangeRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', resolvedAt: new Date() },
  });

  await createNotification(
    request.userId,
    'Email Change Rejected',
    'Your email change request was rejected. Please contact support for more information.',
    'EMAIL_CHANGE_REJECTED'
  );

  return updated;
}

export async function getProofImageFile(
  requestId: string
): Promise<{ request: EmailChangeRequest; absolutePath: string }> {
  const request = await prisma.emailChangeRequest.findUnique({ where: { id: requestId } });
  if (!request?.proofImagePath) {
    throw new AppError(404, 'PROOF_IMAGE_NOT_FOUND', 'Proof image not found');
  }

  const absolutePath = path.join(BACKEND_ROOT, request.proofImagePath);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new AppError(404, 'PROOF_IMAGE_FILE_MISSING', 'Proof image file not found on disk');
  }

  return { request, absolutePath };
}
