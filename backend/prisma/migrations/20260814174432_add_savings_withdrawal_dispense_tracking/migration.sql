-- AlterTable
ALTER TABLE "personal_savings_history" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "dispensedAt" TIMESTAMP(3);
