import type { Transaction } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { toSafeUser } from '../auth/auth.types';
import type { SafeUser } from '../auth/auth.types';
import { createNotification } from '../notifications/notifications.service';
import type { BulkDisburseInput } from './scholarship.schema';

function titleCaseCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

export async function getStudents(): Promise<SafeUser[]> {
  const students = await prisma.user.findMany({
    where: { userType: 'STUDENT', kycStatus: 'VERIFIED', suspended: false },
    orderBy: { fullName: 'asc' },
  });
  return students.map(toSafeUser);
}

export type SkippedDisbursement = {
  studentId: string;
  reason: 'STUDENT_NOT_VERIFIED';
};

export async function bulkDisburse(
  institutionUserId: string,
  input: BulkDisburseInput
): Promise<{
  transactions: Transaction[];
  totalDisbursed: number;
  skipped: SkippedDisbursement[];
}> {
  const uniqueStudentIds = [...new Set(input.studentIds)];

  const allStudents = await prisma.user.findMany({
    where: { id: { in: uniqueStudentIds }, userType: 'STUDENT' },
  });
  if (allStudents.length !== uniqueStudentIds.length) {
    throw new AppError(400, 'INVALID_STUDENT', 'One or more selected students were not found');
  }

  const students = allStudents.filter((student) => student.kycStatus === 'VERIFIED');
  const skipped: SkippedDisbursement[] = allStudents
    .filter((student) => student.kycStatus !== 'VERIFIED')
    .map((student) => ({ studentId: student.id, reason: 'STUDENT_NOT_VERIFIED' }));

  if (students.length === 0) {
    return { transactions: [], totalDisbursed: 0, skipped };
  }

  const institutionWallet = await prisma.wallet.findFirst({
    where: { userId: institutionUserId, currency: input.currency },
  });
  if (!institutionWallet) {
    throw new AppError(
      404,
      'WALLET_NOT_FOUND',
      `You do not have a ${input.currency} wallet. Top up first.`
    );
  }

  const institution = await prisma.user.findUnique({
    where: { id: institutionUserId },
    select: { fullName: true },
  });

  const totalDisbursed = input.amountPerStudent * students.length;

  const transactions = await prisma.$transaction(async (tx) => {
    const debited = await tx.wallet.updateMany({
      where: { id: institutionWallet.id, balance: { gte: totalDisbursed } },
      data: { balance: { decrement: totalDisbursed } },
    });
    if (debited.count === 0) {
      throw new AppError(
        400,
        'INSUFFICIENT_BALANCE',
        'Insufficient wallet balance for this disbursement'
      );
    }

    const created: Transaction[] = [];
    for (const student of students) {
      const studentWallet = await tx.wallet.upsert({
        where: { userId_currency: { userId: student.id, currency: input.currency } },
        create: { userId: student.id, currency: input.currency, balance: input.amountPerStudent },
        update: { balance: { increment: input.amountPerStudent } },
      });

      // A non-GENERAL category lock restricts how the student can spend this money, same as
      // a parent's locked transfer (see wallet.service.ts transfer()) — without this, the
      // disbursement landed in the wallet's general balance regardless of the chosen category.
      if (input.category !== 'GENERAL') {
        await tx.lockedFund.upsert({
          where: { walletId_category: { walletId: studentWallet.id, category: input.category } },
          create: {
            walletId: studentWallet.id,
            category: input.category,
            amount: input.amountPerStudent,
            totalLocked: input.amountPerStudent,
          },
          update: {
            amount: { increment: input.amountPerStudent },
            totalLocked: { increment: input.amountPerStudent },
          },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          fromWalletId: institutionWallet.id,
          toWalletId: studentWallet.id,
          amount: input.amountPerStudent,
          currency: input.currency,
          category: input.category,
          status: 'AUTO_APPROVED',
          note: input.note ?? 'Scholarship disbursement',
        },
      });
      created.push(transaction);
    }
    return created;
  });

  await Promise.all(
    students.map((student) =>
      createNotification(
        student.id,
        'Scholarship Received',
        `You received ${input.amountPerStudent} ${input.currency} from ${institution?.fullName ?? 'your institution'} for ${titleCaseCategory(input.category)}.`,
        'TRANSFER_RECEIVED'
      )
    )
  );

  return { transactions, totalDisbursed, skipped };
}
