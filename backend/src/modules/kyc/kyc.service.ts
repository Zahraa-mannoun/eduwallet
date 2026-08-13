import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { AcademicDocument, KYCStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { toSafeUser } from '../auth/auth.types';
import type { SafeUser } from '../auth/auth.types';
import { createNotification } from '../notifications/notifications.service';
import type { ReviewKYCInput, SubmitKYCInput } from './kyc.schema';

// backend/src/modules/kyc -> backend (three levels up), so this resolves the same way
// whether the module runs from src/ (tsx) or dist/ (compiled) — both sit one level under backend.
const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads', 'kyc');

// AcademicDocument is shared with the unrelated Blockchain Vault feature (DEGREE,
// TRANSCRIPT, CERTIFICATE documentTypes) — every query below that reasons about KYC
// document history must scope to just these two, or it'll pick up vault uploads too.
const KYC_DOCUMENT_TYPES = new Set(['STUDENT_ID', 'ENROLLMENT_CERTIFICATE']);

export async function submitDocument(
  userId: string,
  input: SubmitKYCInput,
  fileBuffer: Buffer
): Promise<AcademicDocument> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const userDir = path.join(UPLOADS_ROOT, userId);
  await fs.mkdir(userDir, { recursive: true });
  const storedFileName = `${randomUUID()}${path.extname(input.fileName)}`;
  const absoluteFilePath = path.join(userDir, storedFileName);
  await fs.writeFile(absoluteFilePath, fileBuffer);
  const filePath = path.relative(BACKEND_ROOT, absoluteFilePath);

  const [document] = await prisma.$transaction([
    prisma.academicDocument.create({
      data: {
        userId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: fileBuffer.length,
        filePath,
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
        `New KYC submission from ${user.fullName}. Please review their documents.`,
        'KYC_SUBMISSION'
      )
    )
  );

  return document;
}

export async function getDocumentFile(
  documentId: string
): Promise<{ document: AcademicDocument; absolutePath: string }> {
  const document = await prisma.academicDocument.findUnique({ where: { id: documentId } });
  if (!document?.filePath) {
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  }

  const absolutePath = path.join(BACKEND_ROOT, document.filePath);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new AppError(404, 'DOCUMENT_FILE_MISSING', 'Document file not found on disk');
  }

  return { document, absolutePath };
}

// Only lets a student remove a document while their KYC is still PENDING review — once VERIFIED
// the document is their proof of identity and must not be deletable, and once REJECTED the old
// (pre-rejection) document is already hidden from getKYCStatus()'s response, so there's nothing
// left for the client to show a delete button next to anyway.
export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  const document = await prisma.academicDocument.findUnique({ where: { id: documentId } });
  if (!document || document.userId !== userId || !KYC_DOCUMENT_TYPES.has(document.documentType ?? '')) {
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.kycStatus !== 'PENDING') {
    throw new AppError(
      400,
      'KYC_NOT_PENDING',
      'You can only remove a document while your verification is still pending review'
    );
  }

  await prisma.academicDocument.delete({ where: { id: documentId } });

  if (document.filePath) {
    const absolutePath = path.join(BACKEND_ROOT, document.filePath);
    await fs.unlink(absolutePath).catch(() => {});
  }
}

export async function getMyDocuments(userId: string): Promise<AcademicDocument[]> {
  return prisma.academicDocument.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getKYCStatus(userId: string): Promise<{
  kycStatus: KYCStatus;
  documents: AcademicDocument[];
  rejectionReason: string | null;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const allDocuments = await getMyDocuments(userId);
  // While a rejection is outstanding, hide any KYC document uploaded before it — the retry
  // flow needs fresh "re-upload" buttons, not the old rejected files still showing as already
  // submitted. kycRejectedAt is never cleared once set (see reviewKYC()), so once VERIFIED
  // this must be skipped explicitly — otherwise a student who was rejected, resubmitted, and
  // was then approved would keep seeing their own (now irrelevant) documents hidden forever.
  const rejectedAt = user.kycStatus !== 'VERIFIED' ? user.kycRejectedAt : null;
  const documents = rejectedAt
    ? allDocuments.filter(
        (document) => !KYC_DOCUMENT_TYPES.has(document.documentType ?? '') || document.createdAt > rejectedAt
      )
    : allDocuments;

  return { kycStatus: user.kycStatus, documents, rejectionReason: user.kycRejectionReason };
}

export async function reviewKYC(adminUserId: string, input: ReviewKYCInput): Promise<SafeUser> {
  if (input.userId === adminUserId) {
    throw new AppError(400, 'CANNOT_REVIEW_SELF', 'You cannot review your own KYC');
  }

  const student = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!student) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const approved = input.decision === 'APPROVED';
  const kycStatus: KYCStatus = approved ? 'VERIFIED' : 'REJECTED';

  const updatedStudent = await prisma.user.update({
    where: { id: input.userId },
    data: {
      kycStatus,
      // Deliberately NOT cleared on approval — the Resubmissions page is a permanent history
      // log, so a student's prior rejection reason and old/new document split must survive
      // being later verified. Only a fresh rejection overwrites these (set fresh every time,
      // including a second, third, ... rejection of a resubmission, so "old vs new documents"
      // always measures against the most recent rejection). getKYCStatus() is responsible for
      // ignoring this once kycStatus is VERIFIED, since it's history from here on, not a live
      // "retry" state.
      ...(approved ? {} : { kycRejectionReason: input.reason ?? null, kycRejectedAt: new Date() }),
    },
  });

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

export async function getPendingKYC(): Promise<
  (SafeUser & { documents: AcademicDocument[]; hasResubmitted: boolean })[]
> {
  const users = await prisma.user.findMany({
    where: { userType: 'STUDENT' },
    orderBy: { createdAt: 'desc' },
    include: { academicDocuments: { orderBy: { createdAt: 'desc' } } },
  });
  return users.map(({ academicDocuments, ...user }) => {
    const documents = academicDocuments.filter((document) =>
      KYC_DOCUMENT_TYPES.has(document.documentType ?? '')
    );
    const hasResubmitted =
      user.kycRejectedAt !== null &&
      documents.some((document) => document.createdAt > user.kycRejectedAt!);
    return {
      ...toSafeUser(user),
      documents,
      hasResubmitted,
    };
  });
}

export type ResubmissionRow = SafeUser & {
  oldDocuments: AcademicDocument[];
  newDocuments: AcademicDocument[];
};

// A student can have multiple document rows of the same documentType within one side of the
// rejectedAt split (e.g. re-uploaded twice before ever being reviewed, or has gone through more
// than one reject/resubmit cycle). Only the most recent row per type belongs on the page — older
// rows for that same type are stale duplicates, not separate documents to review. Input must
// already be sorted createdAt desc so "first occurrence per type" is "most recent per type".
function latestPerDocumentType(documents: AcademicDocument[]): AcademicDocument[] {
  const seenTypes = new Set<string>();
  const result: AcademicDocument[] = [];
  for (const document of documents) {
    const type = document.documentType ?? '';
    if (seenTypes.has(type)) continue;
    seenTypes.add(type);
    result.push(document);
  }
  return result;
}

// Students who were rejected at least once and have since uploaded at least one KYC
// document newer than that rejection — the admin Resubmissions page's data source. A
// permanent history log: kycRejectedAt is never cleared on approval (see reviewKYC()), so a
// row stays here forever once earned, regardless of whether the student is later verified.
export async function getResubmissions(): Promise<ResubmissionRow[]> {
  const users = await prisma.user.findMany({
    where: { userType: 'STUDENT', kycRejectedAt: { not: null } },
    orderBy: { kycRejectedAt: 'desc' },
    include: { academicDocuments: { orderBy: { createdAt: 'desc' } } },
  });

  return users
    .map(({ academicDocuments, ...user }) => {
      const rejectedAt = user.kycRejectedAt as Date;
      const kycDocuments = academicDocuments.filter((document) =>
        KYC_DOCUMENT_TYPES.has(document.documentType ?? '')
      );
      // Strictly split on rejectedAt, then dedupe each side down to one row per documentType
      // (the two arrays are still createdAt-desc here, so this keeps the row closest to the
      // rejection on each side: the actual rejected upload, and the actual latest resubmission).
      const oldDocuments = latestPerDocumentType(
        kycDocuments.filter((document) => document.createdAt <= rejectedAt)
      );
      const newDocuments = latestPerDocumentType(
        kycDocuments.filter((document) => document.createdAt > rejectedAt)
      );
      return {
        ...toSafeUser(user),
        oldDocuments,
        newDocuments,
      };
    })
    .filter((row) => row.newDocuments.length > 0);
}
