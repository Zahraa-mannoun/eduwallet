-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('STUDENT', 'PARENT', 'INSTITUTION', 'ADMIN');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'LBP');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('TUITION', 'BOOKS', 'FOOD', 'TRANSPORT', 'SOFTWARE', 'RENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'AUTO_APPROVED', 'APPROVED', 'REJECTED', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('STORED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "FraudAlertType" AS ENUM ('CIRCULAR', 'VELOCITY', 'DUPLICATE', 'UNUSUAL_AMOUNT');

-- CreateEnum
CREATE TYPE "FraudSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "userType" "UserType" NOT NULL,
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "fromWalletId" TEXT,
    "toWalletId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "category" "TransactionCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_cards" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "cvv" TEXT NOT NULL,
    "expiry" TIMESTAMP(3) NOT NULL,
    "merchantLock" TEXT,
    "categoryLock" "TransactionCategory",
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virtual_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "monthlyLimit" DECIMAL(12,2) NOT NULL,
    "spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "month" TEXT NOT NULL,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parental_controls" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "approvalThreshold" DECIMAL(12,2) NOT NULL,
    "categories" "TransactionCategory"[],

    CONSTRAINT "parental_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "blockchainTxHash" TEXT,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'STORED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_alerts" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "alertType" "FraudAlertType" NOT NULL,
    "severity" "FraudSeverity" NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "transactions_fromWalletId_idx" ON "transactions"("fromWalletId");

-- CreateIndex
CREATE INDEX "transactions_toWalletId_idx" ON "transactions"("toWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "virtual_cards_cardNumber_key" ON "virtual_cards"("cardNumber");

-- CreateIndex
CREATE INDEX "virtual_cards_walletId_idx" ON "virtual_cards"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_categories_walletId_category_month_key" ON "budget_categories"("walletId", "category", "month");

-- CreateIndex
CREATE UNIQUE INDEX "parental_controls_parentUserId_studentUserId_key" ON "parental_controls"("parentUserId", "studentUserId");

-- CreateIndex
CREATE INDEX "academic_documents_userId_idx" ON "academic_documents"("userId");

-- CreateIndex
CREATE INDEX "fraud_alerts_transactionId_idx" ON "fraud_alerts"("transactionId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fromWalletId_fkey" FOREIGN KEY ("fromWalletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_toWalletId_fkey" FOREIGN KEY ("toWalletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_cards" ADD CONSTRAINT "virtual_cards_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_controls" ADD CONSTRAINT "parental_controls_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_controls" ADD CONSTRAINT "parental_controls_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_documents" ADD CONSTRAINT "academic_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
