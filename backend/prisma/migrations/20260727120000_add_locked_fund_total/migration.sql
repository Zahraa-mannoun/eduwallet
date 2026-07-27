-- AddColumn
ALTER TABLE "locked_funds" ADD COLUMN "totalLocked" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill: for funds locked before this column existed, the current remaining balance is
-- the best available approximation of the original total (no historical increment ledger).
UPDATE "locked_funds" SET "totalLocked" = "amount";
