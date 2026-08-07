import type {
  LockedFund,
  ParentalControl,
  Transaction,
  TransactionCategory,
  User,
  Wallet,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { isUniqueConstraintError } from '../../utils/prismaErrors';
import { updateSpent } from '../budget/budget.service';
import { createNotification } from '../notifications/notifications.service';
import { runAllChecks } from '../wallet/fraud.service';
import type { LinkStudentInput, UpdateSettingsInput } from './parental.schema';

function formatCategoriesList(categories: TransactionCategory[]): string {
  return categories.length > 0 ? categories.map((category) => category.toLowerCase()).join(', ') : 'none';
}

function formatThreshold(threshold: number | string): string {
  return Number(threshold) > 0 ? `$${Number(threshold)}` : 'No limit';
}

async function assertLinked(
  parentUserId: string,
  studentUserId: string
): Promise<ParentalControl> {
  const link = await prisma.parentalControl.findUnique({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId } },
  });
  if (!link) {
    throw new AppError(403, 'NOT_LINKED', 'You are not linked to this student');
  }
  return link;
}

export async function linkStudent(
  parentUserId: string,
  input: LinkStudentInput
): Promise<ParentalControl> {
  const student = await prisma.user.findUnique({ where: { email: input.studentEmail } });
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'No account found with this email');
  }
  if (student.userType !== 'STUDENT') {
    throw new AppError(400, 'INVALID_STUDENT', 'This account is not a student account');
  }
  if (student.kycStatus !== 'VERIFIED') {
    throw new AppError(
      400,
      'STUDENT_NOT_VERIFIED',
      'Student must complete university verification before being linked to a parent account.'
    );
  }

  const existing = await prisma.parentalControl.findUnique({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId: student.id } },
  });
  if (existing) {
    throw new AppError(409, 'ALREADY_LINKED', 'You are already linked to this student');
  }

  const existingLinkToAnyParent = await prisma.parentalControl.findFirst({
    where: { studentUserId: student.id },
  });
  if (existingLinkToAnyParent) {
    throw new AppError(
      409,
      'STUDENT_ALREADY_LINKED',
      'This student is already linked to a parent.'
    );
  }

  let link: ParentalControl;
  try {
    link = await prisma.parentalControl.create({
      data: {
        parentUserId,
        studentUserId: student.id,
        approvalThreshold: input.approvalThreshold,
        categories: input.categories,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'ALREADY_LINKED', 'You are already linked to this student');
    }
    throw error;
  }

  const parent = await prisma.user.findUnique({
    where: { id: parentUserId },
    select: { fullName: true },
  });

  await createNotification(
    student.id,
    'Parent Account Linked',
    `${parent?.fullName ?? 'Your parent'} has linked to your account. Allowed categories: ${formatCategoriesList(input.categories)}. Approval threshold: ${formatThreshold(input.approvalThreshold)}.`,
    'PARENT_LINKED'
  );

  return link;
}

export async function unlinkStudent(parentUserId: string, studentUserId: string): Promise<void> {
  await assertLinked(parentUserId, studentUserId);
  await prisma.parentalControl.delete({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId } },
  });
}

export async function updateSettings(
  parentUserId: string,
  studentUserId: string,
  settings: UpdateSettingsInput
): Promise<ParentalControl> {
  await assertLinked(parentUserId, studentUserId);
  const updated = await prisma.parentalControl.update({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId } },
    data: {
      approvalThreshold: settings.approvalThreshold,
      categories: settings.categories,
    },
  });

  await createNotification(
    studentUserId,
    'Spending Permissions Updated',
    `Your parent updated your spending permissions. Allowed categories: ${formatCategoriesList(settings.categories)}. Threshold: ${formatThreshold(settings.approvalThreshold)}.`,
    'PERMISSIONS_UPDATED'
  );

  return updated;
}

export async function getPendingApprovals(parentUserId: string): Promise<Transaction[]> {
  const links = await prisma.parentalControl.findMany({
    where: { parentUserId },
    select: { studentUserId: true },
  });
  const studentIds = links.map((link) => link.studentUserId);
  if (studentIds.length === 0) {
    return [];
  }

  const wallets = await prisma.wallet.findMany({
    where: { userId: { in: studentIds } },
    select: { id: true },
  });
  const walletIds = wallets.map((wallet) => wallet.id);

  return prisma.transaction.findMany({
    where: { fromWalletId: { in: walletIds }, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
}

async function getPendingTransactionWithSenderWallet(
  transactionId: string
): Promise<{ transaction: Transaction; fromWallet: Wallet }> {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction || !transaction.fromWalletId) {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
  }
  if (transaction.status !== 'PENDING') {
    throw new AppError(
      400,
      'TRANSACTION_NOT_PENDING',
      'This transaction is not awaiting approval'
    );
  }

  const fromWallet = await prisma.wallet.findUnique({ where: { id: transaction.fromWalletId } });
  if (!fromWallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'Sender wallet not found');
  }

  return { transaction, fromWallet };
}

export async function approveTransaction(
  parentUserId: string,
  transactionId: string
): Promise<Transaction> {
  const { transaction, fromWallet } = await getPendingTransactionWithSenderWallet(transactionId);
  await assertLinked(parentUserId, fromWallet.userId);

  if (!transaction.toWalletId) {
    throw new AppError(400, 'INVALID_TRANSACTION', 'Transaction has no recipient wallet');
  }
  const toWalletId = transaction.toWalletId;

  const updatedTransaction = await prisma.$transaction(async (tx) => {
    const debited = await tx.wallet.updateMany({
      where: { id: fromWallet.id, balance: { gte: transaction.amount } },
      data: { balance: { decrement: transaction.amount } },
    });
    if (debited.count === 0) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Student no longer has enough balance');
    }

    await tx.wallet.update({
      where: { id: toWalletId },
      data: { balance: { increment: transaction.amount } },
    });

    return tx.transaction.update({
      where: { id: transaction.id },
      data: { status: 'APPROVED' },
    });
  });

  await updateSpent(fromWallet.id, transaction.category, Number(transaction.amount));

  await runAllChecks(updatedTransaction);

  await createNotification(
    fromWallet.userId,
    'Transaction Approved',
    `Your ${transaction.category.toLowerCase()} transaction of ${transaction.amount} ${transaction.currency} was approved.`,
    'TRANSACTION_APPROVED'
  );

  return updatedTransaction;
}

export async function rejectTransaction(
  parentUserId: string,
  transactionId: string,
  reason: string
): Promise<Transaction> {
  const { transaction, fromWallet } = await getPendingTransactionWithSenderWallet(transactionId);
  await assertLinked(parentUserId, fromWallet.userId);

  const updatedTransaction = await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: 'REJECTED' },
  });

  await createNotification(
    fromWallet.userId,
    'Transaction Rejected',
    `Your ${transaction.category.toLowerCase()} transaction of ${transaction.amount} ${transaction.currency} was rejected: ${reason}`,
    'TRANSACTION_REJECTED'
  );

  return updatedTransaction;
}

export type MyPermissions = {
  allowedCategories: ParentalControl['categories'];
  approvalThreshold: ParentalControl['approvalThreshold'];
  parentName: string;
};

export async function getMyPermissions(studentUserId: string): Promise<MyPermissions | null> {
  const link = await prisma.parentalControl.findFirst({ where: { studentUserId } });
  if (!link) {
    return null;
  }

  const parent = await prisma.user.findUnique({
    where: { id: link.parentUserId },
    select: { fullName: true },
  });

  return {
    allowedCategories: link.categories,
    approvalThreshold: link.approvalThreshold,
    parentName: parent?.fullName ?? 'Parent',
  };
}

export type LinkedStudent = {
  student: Omit<User, 'password'>;
  link: ParentalControl;
  wallets: (Wallet & { lockedFunds: LockedFund[] })[];
};

export async function getLinkedStudents(parentUserId: string): Promise<LinkedStudent[]> {
  const links = await prisma.parentalControl.findMany({ where: { parentUserId } });

  return Promise.all(
    links.map(async (link): Promise<LinkedStudent> => {
      const student = await prisma.user.findUnique({ where: { id: link.studentUserId } });
      if (!student) {
        throw new AppError(404, 'STUDENT_NOT_FOUND', 'Linked student no longer exists');
      }
      const wallets = await prisma.wallet.findMany({
        where: { userId: link.studentUserId },
        include: { lockedFunds: true },
      });
      const { password: _password, ...safeStudent } = student;

      return { student: safeStudent, link, wallets };
    })
  );
}

export type StudentCategoryBreakdown = {
  category: TransactionCategory;
  locked: number;
  spent: number;
};

// Spent = the student's own completed spending in that category, all-time. Combined with
// the category's currently-locked balance, this gives parents a sense of how far a category's
// locked funds have been drawn down, without needing a separate "total ever locked" column.
export async function getStudentSpendingBreakdown(
  parentUserId: string,
  studentUserId: string
): Promise<{ allowedCategories: TransactionCategory[]; categories: StudentCategoryBreakdown[] }> {
  const link = await assertLinked(parentUserId, studentUserId);

  const wallet = await prisma.wallet.findFirst({
    where: { userId: studentUserId },
    orderBy: { createdAt: 'asc' },
    include: { lockedFunds: true },
  });
  if (!wallet) {
    throw new AppError(404, 'WALLET_NOT_FOUND', 'This student has no wallet');
  }

  const spentByCategory = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      fromWalletId: wallet.id,
      category: { not: 'GENERAL' },
      status: { in: ['AUTO_APPROVED', 'APPROVED'] },
    },
    _sum: { amount: true },
  });
  const spentLookup = new Map(
    spentByCategory.map((entry) => [entry.category, Number(entry._sum.amount ?? 0)])
  );

  const categoryKeys = new Set<TransactionCategory>([
    ...link.categories,
    ...wallet.lockedFunds.map((fund) => fund.category),
  ]);
  categoryKeys.delete('GENERAL');

  const categories: StudentCategoryBreakdown[] = [...categoryKeys].map((category) => ({
    category,
    locked: Number(wallet.lockedFunds.find((fund) => fund.category === category)?.amount ?? 0),
    spent: spentLookup.get(category) ?? 0,
  }));

  return { allowedCategories: link.categories, categories };
}
