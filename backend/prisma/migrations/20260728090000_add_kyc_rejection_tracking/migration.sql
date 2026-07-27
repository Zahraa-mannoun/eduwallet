-- AddColumn
ALTER TABLE "users" ADD COLUMN "kycRejectionReason" TEXT;
ALTER TABLE "users" ADD COLUMN "kycRejectedAt" TIMESTAMP(3);
