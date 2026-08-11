-- Rename completedAt -> createdAt (it now records the timestamp of any transition, not just
-- completion) without losing the existing values.
ALTER TABLE "withdrawal_history" RENAME COLUMN "completedAt" TO "createdAt";

-- receiptVerificationStatus is no longer guaranteed to be meaningful for every transition
-- (e.g. a PENDING_PARENT_APPROVAL row has no receipt yet), so it becomes optional.
ALTER TABLE "withdrawal_history" ALTER COLUMN "receiptVerificationStatus" DROP NOT NULL;

-- New audit columns.
ALTER TABLE "withdrawal_history" ADD COLUMN "note" TEXT;
ALTER TABLE "withdrawal_history" ADD COLUMN "status" "WithdrawalStatus";

-- Every existing row was created by the old disburse()-only code path, which only ever ran on
-- a COMPLETED transition — backfill accordingly before making the column required.
UPDATE "withdrawal_history" SET "status" = 'COMPLETED' WHERE "status" IS NULL;

ALTER TABLE "withdrawal_history" ALTER COLUMN "status" SET NOT NULL;
