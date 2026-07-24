-- CreateTable
CREATE TABLE "locked_funds" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locked_funds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locked_funds_walletId_idx" ON "locked_funds"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "locked_funds_walletId_category_key" ON "locked_funds"("walletId", "category");

-- AddForeignKey
ALTER TABLE "locked_funds" ADD CONSTRAINT "locked_funds_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
