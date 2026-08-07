-- CreateEnum
CREATE TYPE "SupportMessageType" AS ENUM ('SUSPENSION_APPEAL', 'GENERAL');

-- AlterTable
ALTER TABLE "support_messages" ADD COLUMN     "subject" TEXT,
ADD COLUMN     "type" "SupportMessageType" NOT NULL DEFAULT 'SUSPENSION_APPEAL';
