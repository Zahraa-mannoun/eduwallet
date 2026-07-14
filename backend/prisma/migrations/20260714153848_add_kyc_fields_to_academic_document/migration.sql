-- CreateEnum
CREATE TYPE "KYCDocumentType" AS ENUM ('STUDENT_ID', 'ENROLLMENT_CERTIFICATE');

-- AlterTable
ALTER TABLE "academic_documents" ADD COLUMN     "documentType" "KYCDocumentType",
ADD COLUMN     "fileSize" INTEGER,
ALTER COLUMN "fileType" DROP NOT NULL,
ALTER COLUMN "sha256Hash" DROP NOT NULL;
