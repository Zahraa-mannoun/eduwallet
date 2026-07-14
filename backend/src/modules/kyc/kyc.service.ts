import type { AcademicDocument, KYCStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { toSafeUser } from '../auth/auth.types';
import type { SafeUser } from '../auth/auth.types';
import { createNotification } from '../notifications/notifications.service';
import type { ReviewKYCInput, SubmitKYCInput } from './kyc.schema';

export async function submitDocument(
  userId: string,
  input: SubmitKYCInput
): Promise<AcademicDocument> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const [document] = await prisma.$transaction([
    prisma.academicDocument.create({
      data: {
        userId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        documentType: input.documentType,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'PENDING' },
    }),
  ]);

  const admins = await prisma.user.findMany({
    where: { userType: 'ADMIN' },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        admin.id,
        'New KYC Submission',
        `New KYC submission from ${user.fullName}.`,
        'KYC_SUBMITTED'
      )
    )
  );

  return document;
}

export async function getMyDocuments(userId: string): Promise<AcademicDocument[]> {
  return prisma.academicDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getKYCStatus(
  userId: string
): Promise<{ kycStatus: KYCStatus; documents: AcademicDocument[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const documents = await getMyDocuments(userId);
  return { kycStatus: user.kycStatus, documents };
}

export async function reviewKYC(adminUserId: string, input: ReviewKYCInput): Promise<SafeUser> {
  if (input.userId === adminUserId) {
    throw new AppError(400, 'CANNOT_REVIEW_SELF', 'You cannot review your own KYC');
  }

  const student = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!student) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const kycStatus: KYCStatus = input.decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';

  const updatedStudent = await prisma.user.update({
    where: { id: input.userId },
    data: { kycStatus },
  });

  const approved = input.decision === 'APPROVED';
  await createNotification(
    input.userId,
    approved ? 'KYC Approved' : 'KYC Rejected',
    approved
      ? 'Your KYC was approved.'
      : `Your KYC was rejected${input.reason ? `: ${input.reason}` : '.'}`,
    approved ? 'KYC_APPROVED' : 'KYC_REJECTED'
  );

  return toSafeUser(updatedStudent);
}

export async function getPendingKYC(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({
    where: { kycStatus: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  return users.map(toSafeUser);
}
