import { createHash, randomBytes } from 'crypto';
import type { AcademicDocument } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import type { UploadDocumentInput } from './blockchain.schema';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

// AcademicDocument is shared with the unrelated KYC feature (STUDENT_ID, ENROLLMENT_CERTIFICATE
// documentTypes, created by kyc.service.ts's submitDocument() — which never sets sha256Hash/
// blockchainTxHash). Every vault query must scope to just these three types, or a student's KYC
// uploads show up here too with a missing hash and a Verify button that silently no-ops.
const VAULT_DOCUMENT_TYPES = new Set(['DEGREE', 'TRANSCRIPT', 'CERTIFICATE']);

export function hashDocument(fileContent: Buffer): string {
  return createHash('sha256').update(fileContent).digest('hex');
}

function generateMockBlockchainTxHash(): string {
  return `0x${randomBytes(32).toString('hex')}`;
}

export async function uploadDocument(
  userId: string,
  input: UploadDocumentInput,
  fileBuffer: Buffer
): Promise<AcademicDocument> {
  const sha256Hash = hashDocument(fileBuffer);
  const blockchainTxHash = generateMockBlockchainTxHash();

  return prisma.academicDocument.create({
    data: {
      userId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: fileBuffer.length,
      documentType: input.documentType,
      documentName: input.documentName,
      sha256Hash,
      blockchainTxHash,
    },
  });
}

export async function getMyDocuments(userId: string): Promise<AcademicDocument[]> {
  return prisma.academicDocument.findMany({
    where: { userId, documentType: { in: [...VAULT_DOCUMENT_TYPES] } },
    orderBy: { createdAt: 'desc' },
  });
}

export type VerifyDocumentResult =
  | {
      status: 'AUTHENTIC';
      documentName: string | null;
      documentType: string | null;
      issuedTo: string;
      blockchainTxHash: string | null;
      createdAt: Date;
    }
  | { status: 'NOT_FOUND' };

export async function verifyDocument(hash: string): Promise<VerifyDocumentResult> {
  const document = await prisma.academicDocument.findFirst({
    where: { sha256Hash: hash },
    include: { user: { select: { fullName: true } } },
  });

  if (!document) {
    return { status: 'NOT_FOUND' };
  }

  return {
    status: 'AUTHENTIC',
    documentName: document.documentName,
    documentType: document.documentType,
    issuedTo: document.user.fullName,
    blockchainTxHash: document.blockchainTxHash,
    createdAt: document.createdAt,
  };
}

async function getOwnedDocument(userId: string, documentId: string): Promise<AcademicDocument> {
  const document = await prisma.academicDocument.findUnique({ where: { id: documentId } });
  if (!document || document.userId !== userId) {
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  }
  return document;
}

export type DocumentWithQRData = AcademicDocument & { qrData: string };

export async function getDocumentById(
  userId: string,
  documentId: string
): Promise<DocumentWithQRData> {
  const document = await getOwnedDocument(userId, documentId);
  const qrData = document.sha256Hash ? `${APP_URL}/blockchain/verify/${document.sha256Hash}` : '';
  return { ...document, qrData };
}
