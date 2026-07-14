-- AlterTable
ALTER TABLE "academic_documents" ADD COLUMN     "documentName" TEXT,
DROP COLUMN "documentType",
ADD COLUMN     "documentType" TEXT;

-- DropEnum
DROP TYPE "KYCDocumentType";
