import type { ParentalControl, Transaction, User, Wallet } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import type { LinkStudentInput, UpdateSettingsInput } from './parental.schema';

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

  const existing = await prisma.parentalControl.findUnique({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId: student.id } },
  });
  if (existing) {
    throw new AppError(409, 'ALREADY_LINKED', 'You are already linked to this student');
  }

  return prisma.parentalControl.create({
    data: {
      parentUserId,
      studentUserId: student.id,
      approvalThreshold: input.approvalThreshold,
      categories: input.categories,
    },
  });
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
  return prisma.parentalControl.update({
    where: { parentUserId_studentUserId: { parentUserId, studentUserId } },
    data: {
      approvalThreshold: settings.approvalThreshold,
      categories: settings.categories,
    },
  });
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

  await prisma.notification.create({
    data: {
      userId: fromWallet.userId,
      title: 'Transaction Approved',
      message: `Your ${transaction.category.toLowerCase()} transaction of ${transaction.amount} ${transaction.currency} was approved.`,
      type: 'TRANSACTION_APPROVED',
    },
  });

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

  await prisma.notification.create({
    data: {
      userId: fromWallet.userId,
      title: 'Transaction Rejected',
      message: `Your ${transaction.category.toLowerCase()} transaction of ${transaction.amount} ${transaction.currency} was rejected: ${reason}`,
      type: 'TRANSACTION_REJECTED',
    },
  });

  return updatedTransaction;
}

export type LinkedStudent = {
  student: Omit<User, 'password'>;
  link: ParentalControl;
  wallets: Wallet[];
};

export async function getLinkedStudents(parentUserId: string): Promise<LinkedStudent[]> {
  const links = await prisma.parentalControl.findMany({ where: { parentUserId } });

  return Promise.all(
    links.map(async (link): Promise<LinkedStudent> => {
      const student = await prisma.user.findUnique({ where: { id: link.studentUserId } });
      if (!student) {
        throw new AppError(404, 'STUDENT_NOT_FOUND', 'Linked student no longer exists');
      }
      const wallets = await prisma.wallet.findMany({ where: { userId: link.studentUserId } });
      const { password: _password, ...safeStudent } = student;

      return { student: safeStudent, link, wallets };
    })
  );
}
