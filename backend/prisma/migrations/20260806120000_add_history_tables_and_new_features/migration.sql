-- CreateEnum
CREATE TYPE "SavingsHistoryType" AS ENUM ('ROLLOVER', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED');

-- CreateEnum
CREATE TYPE "SavingsHistoryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReceiptVerificationStatus" AS ENUM ('PENDING', 'AUTO_VERIFIED', 'FLAGGED', 'MANUALLY_VERIFIED');

-- CreateEnum
CREATE TYPE "EmailChangeStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ReportPeriod" AS ENUM ('LAST_WEEK', 'LAST_MONTH', 'LAST_YEAR', 'LAST_2_YEARS');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATED');

-- CreateEnum
CREATE TYPE "MerchantType" AS ENUM ('RESTAURANT', 'SHOPPING_CENTER', 'SOFTWARE_STORE', 'BOOKSTORE', 'PHARMACY', 'TRANSPORT');

-- AlterEnum (rename in place to preserve existing rows, then add the new savings category)
ALTER TYPE "TransactionCategory" RENAME VALUE 'PERSONAL' TO 'LIFESTYLE';
ALTER TYPE "TransactionCategory" ADD VALUE 'PERSONAL_SAVINGS' BEFORE 'GENERAL';

-- CreateTable
CREATE TABLE "card_history" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "lastFourDigits" TEXT NOT NULL,
    "categoryLock" "TransactionCategory",
    "merchantLock" TEXT,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "merchantName" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parental_control_history" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL,
    "unlinkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoriesAllowed" "TransactionCategory"[],
    "approvalThreshold" DECIMAL(12,2) NOT NULL,
    "totalAmountSent" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "parental_control_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_budget_history" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "monthlyLimit" DECIMAL(12,2) NOT NULL,
    "totalSpent" DECIMAL(12,2) NOT NULL,
    "month" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_budget_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_savings" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_savings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_savings_history" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "SavingsHistoryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" TEXT,
    "reason" TEXT,
    "status" "SavingsHistoryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_savings_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "receiptPath" TEXT,
    "receiptVerificationStatus" "ReceiptVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "receiptVerificationNote" TEXT,
    "merchantName" TEXT,
    "detectedCategory" "TransactionCategory",
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_history" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "withdrawalRequestId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "merchantName" TEXT,
    "receiptVerificationStatus" "ReceiptVerificationStatus" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentEmail" TEXT NOT NULL,
    "requestedEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proofImagePath" TEXT,
    "status" "EmailChangeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "email_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_requests" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "period" "ReportPeriod" NOT NULL,
    "includeCardPurchases" BOOLEAN NOT NULL DEFAULT false,
    "includeTransfers" BOOLEAN NOT NULL DEFAULT false,
    "includeWithdrawals" BOOLEAN NOT NULL DEFAULT false,
    "includeFlagged" BOOLEAN NOT NULL DEFAULT false,
    "includePending" BOOLEAN NOT NULL DEFAULT false,
    "includeSavings" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" TIMESTAMP(3),

    CONSTRAINT "report_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "address" TEXT,
    "type" "MerchantType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_courses" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "costPerCredit" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "semester" TEXT NOT NULL,

    CONSTRAINT "university_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_students" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "userId" TEXT,
    "studentNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "totalCreditCost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UniversityCourseToUniversityStudent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UniversityCourseToUniversityStudent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "card_history_walletId_idx" ON "card_history"("walletId");

-- CreateIndex
CREATE INDEX "parental_control_history_parentUserId_idx" ON "parental_control_history"("parentUserId");

-- CreateIndex
CREATE INDEX "parental_control_history_studentUserId_idx" ON "parental_control_history"("studentUserId");

-- CreateIndex
CREATE INDEX "monthly_budget_history_walletId_idx" ON "monthly_budget_history"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "personal_savings_walletId_key" ON "personal_savings"("walletId");

-- CreateIndex
CREATE INDEX "personal_savings_history_walletId_idx" ON "personal_savings_history"("walletId");

-- CreateIndex
CREATE INDEX "withdrawal_requests_walletId_idx" ON "withdrawal_requests"("walletId");

-- CreateIndex
CREATE INDEX "withdrawal_history_walletId_idx" ON "withdrawal_history"("walletId");

-- CreateIndex
CREATE INDEX "withdrawal_history_withdrawalRequestId_idx" ON "withdrawal_history"("withdrawalRequestId");

-- CreateIndex
CREATE INDEX "email_change_requests_userId_idx" ON "email_change_requests"("userId");

-- CreateIndex
CREATE INDEX "report_requests_parentUserId_idx" ON "report_requests"("parentUserId");

-- CreateIndex
CREATE INDEX "report_requests_studentUserId_idx" ON "report_requests"("studentUserId");

-- CreateIndex
CREATE INDEX "university_courses_universityId_idx" ON "university_courses"("universityId");

-- CreateIndex
CREATE INDEX "university_students_universityId_idx" ON "university_students"("universityId");

-- CreateIndex
CREATE INDEX "university_students_userId_idx" ON "university_students"("userId");

-- CreateIndex
CREATE INDEX "_UniversityCourseToUniversityStudent_B_index" ON "_UniversityCourseToUniversityStudent"("B");

-- AddForeignKey
ALTER TABLE "card_history" ADD CONSTRAINT "card_history_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_control_history" ADD CONSTRAINT "parental_control_history_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_control_history" ADD CONSTRAINT "parental_control_history_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budget_history" ADD CONSTRAINT "monthly_budget_history_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_savings" ADD CONSTRAINT "personal_savings_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_savings_history" ADD CONSTRAINT "personal_savings_history_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_history" ADD CONSTRAINT "withdrawal_history_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_history" ADD CONSTRAINT "withdrawal_history_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "withdrawal_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_courses" ADD CONSTRAINT "university_courses_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_students" ADD CONSTRAINT "university_students_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_students" ADD CONSTRAINT "university_students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UniversityCourseToUniversityStudent" ADD CONSTRAINT "_UniversityCourseToUniversityStudent_A_fkey" FOREIGN KEY ("A") REFERENCES "university_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UniversityCourseToUniversityStudent" ADD CONSTRAINT "_UniversityCourseToUniversityStudent_B_fkey" FOREIGN KEY ("B") REFERENCES "university_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
