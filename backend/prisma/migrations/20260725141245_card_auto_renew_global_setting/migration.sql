-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cardAutoRenew" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "virtual_cards" DROP COLUMN "autoRenew";
