import { FraudAlertType, FraudSeverity } from '@prisma/client';
import type { Transaction } from '@prisma/client';
import { prisma } from '../../config/database';

const CIRCULAR_WINDOW_MS = 60 * 60 * 1000;
const VELOCITY_WINDOW_MS = 10 * 60 * 1000;
const VELOCITY_THRESHOLD = 5;
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const UNUSUAL_AMOUNT_MULTIPLIER = 3;
const UNUSUAL_AMOUNT_HISTORY_SIZE = 50;

export async function checkCircularTransfer(
  fromWalletId: string,
  toWalletId: string,
  excludeTransactionId: string
): Promise<boolean> {
  const since = new Date(Date.now() - CIRCULAR_WINDOW_MS);
  const reverseTransfer = await prisma.transaction.findFirst({
    where: {
      id: { not: excludeTransactionId },
      fromWalletId: toWalletId,
      toWalletId: fromWalletId,
      createdAt: { gte: since },
    },
  });
  return reverseTransfer !== null;
}

export async function checkVelocity(
  walletId: string,
  excludeTransactionId: string
): Promise<boolean> {
  const since = new Date(Date.now() - VELOCITY_WINDOW_MS);
  const count = await prisma.transaction.count({
    where: {
      id: { not: excludeTransactionId },
      OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      createdAt: { gte: since },
    },
  });
  return count >= VELOCITY_THRESHOLD;
}

export async function checkDuplicate(
  fromWalletId: string,
  toWalletId: string,
  amount: number,
  excludeTransactionId: string
): Promise<boolean> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const duplicate = await prisma.transaction.findFirst({
    where: {
      id: { not: excludeTransactionId },
      fromWalletId,
      toWalletId,
      amount,
      createdAt: { gte: since },
    },
  });
  return duplicate !== null;
}

export async function checkUnusualAmount(
  walletId: string,
  amount: number,
  excludeTransactionId: string
): Promise<boolean> {
  const history = await prisma.transaction.findMany({
    where: {
      id: { not: excludeTransactionId },
      fromWalletId: walletId,
    },
    select: { amount: true },
    orderBy: { createdAt: 'desc' },
    take: UNUSUAL_AMOUNT_HISTORY_SIZE,
  });

  if (history.length === 0) {
    return false;
  }

  const average =
    history.reduce((sum, transaction) => sum + Number(transaction.amount), 0) / history.length;

  return average > 0 && amount > average * UNUSUAL_AMOUNT_MULTIPLIER;
}

export async function runAllChecks(transaction: Transaction): Promise<void> {
  const amount = Number(transaction.amount);
  const alerts: { alertType: FraudAlertType; severity: FraudSeverity }[] = [];

  if (transaction.fromWalletId && transaction.toWalletId) {
    if (
      await checkCircularTransfer(transaction.fromWalletId, transaction.toWalletId, transaction.id)
    ) {
      alerts.push({ alertType: FraudAlertType.CIRCULAR, severity: FraudSeverity.HIGH });
    }

    if (
      await checkDuplicate(transaction.fromWalletId, transaction.toWalletId, amount, transaction.id)
    ) {
      alerts.push({ alertType: FraudAlertType.DUPLICATE, severity: FraudSeverity.MEDIUM });
    }
  }

  const velocityWalletId = transaction.fromWalletId ?? transaction.toWalletId;
  if (velocityWalletId && (await checkVelocity(velocityWalletId, transaction.id))) {
    alerts.push({ alertType: FraudAlertType.VELOCITY, severity: FraudSeverity.MEDIUM });
  }

  if (
    transaction.fromWalletId &&
    (await checkUnusualAmount(transaction.fromWalletId, amount, transaction.id))
  ) {
    alerts.push({ alertType: FraudAlertType.UNUSUAL_AMOUNT, severity: FraudSeverity.LOW });
  }

  if (alerts.length > 0) {
    await prisma.fraudAlert.createMany({
      data: alerts.map((alert) => ({
        transactionId: transaction.id,
        alertType: alert.alertType,
        severity: alert.severity,
      })),
    });
  }
}
