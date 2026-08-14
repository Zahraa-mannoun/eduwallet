-- CreateTable
CREATE TABLE "locked_fund_history" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "totalLocked" DECIMAL(12,2) NOT NULL,
    "totalSpent" DECIMAL(12,2) NOT NULL,
    "rolledOver" DECIMAL(12,2) NOT NULL,
    "month" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locked_fund_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locked_fund_history_walletId_idx" ON "locked_fund_history"("walletId");

-- AddForeignKey
ALTER TABLE "locked_fund_history" ADD CONSTRAINT "locked_fund_history_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
