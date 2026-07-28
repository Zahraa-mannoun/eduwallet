import type { AcademicDocument } from '../types/api';
import { apiRequest } from './api';

export type UploadDocumentInput = {
  fileUri: string;
  fileName: string;
  fileType: string;
  documentName: string;
  documentType: 'DEGREE' | 'TRANSCRIPT' | 'CERTIFICATE';
  // Present on web only (expo-document-picker returns a real File object there — see
  // DocumentPickerAsset.file). On web, appending the RN { uri, name, type } descriptor below
  // to FormData does NOT attach real file bytes (it just stringifies the object), which was
  // silently uploading empty documents — a real File/Blob is required there instead.
  file?: File;
};

export async function uploadDocument(input: UploadDocumentInput): Promise<AcademicDocument> {
  const formData = new FormData();
  if (input.file) {
    formData.append('file', input.file, input.fileName);
  } else {
    formData.append(
      'file',
      // React Native's FormData accepts this { uri, name, type } file descriptor shape,
      // which isn't a real Blob at runtime — the cast reflects that RN-specific contract.
      { uri: input.fileUri, name: input.fileName, type: input.fileType } as unknown as Blob
    );
  }
  formData.append('fileName', input.fileName);
  formData.append('fileType', input.fileType);
  formData.append('documentName', input.documentName);
  formData.append('documentType', input.documentType);

  return apiRequest<AcademicDocument>('/blockchain/upload', { method: 'POST', formData });
}

export async function getDocuments(): Promise<AcademicDocument[]> {
  return apiRequest<AcademicDocument[]>('/blockchain/documents');
}

export async function getDocumentById(id: string): Promise<AcademicDocument & { qrData: string }> {
  return apiRequest(`/blockchain/documents/${id}`);
}

export type VerifyResult =
  | {
      status: 'AUTHENTIC';
      documentName: string | null;
      documentType: string | null;
      issuedTo: string;
      blockchainTxHash: string | null;
      createdAt: string;
    }
  | { status: 'NOT_FOUND' };

export async function verifyDocument(hash: string): Promise<VerifyResult> {
  return apiRequest<VerifyResult>('/blockchain/verify', { method: 'POST', body: { hash }, auth: false });
}
