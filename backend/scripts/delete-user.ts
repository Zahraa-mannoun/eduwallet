import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// No cascade deletes are configured in schema.prisma, so children must be removed in
// FK-safe order (deepest dependents first) before the User row itself can go.
const TARGET_EMAIL = 'ngo@gmail.com';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    console.log(`No user found with email ${TARGET_EMAIL} — nothing to delete.`);
    return;
  }

  const wallets = await prisma.wallet.findMany({ where: { userId: user.id }, select: { id: true } });
  const walletIds = wallets.map((w) => w.id);

  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ fromWalletId: { in: walletIds } }, { toWalletId: { in: walletIds } }] },
    select: { id: true },
  });
  const transactionIds = transactions.map((t) => t.id);

  const result = await prisma.$transaction(async (tx) => {
    const fraudAlerts = await tx.fraudAlert.deleteMany({
      where: { transactionId: { in: transactionIds } },
    });
    const txDeleted = await tx.transaction.deleteMany({
      where: { id: { in: transactionIds } },
    });
    const virtualCards = await tx.virtualCard.deleteMany({ where: { walletId: { in: walletIds } } });
    const budgetCategories = await tx.budgetCategory.deleteMany({ where: { walletId: { in: walletIds } } });
    const lockedFunds = await tx.lockedFund.deleteMany({ where: { walletId: { in: walletIds } } });
    const walletsDeleted = await tx.wallet.deleteMany({ where: { id: { in: walletIds } } });

    const academicDocuments = await tx.academicDocument.deleteMany({ where: { userId: user.id } });
    const notifications = await tx.notification.deleteMany({ where: { userId: user.id } });
    const supportMessages = await tx.supportMessage.deleteMany({ where: { userId: user.id } });
    const parentalControls = await tx.parentalControl.deleteMany({
      where: { OR: [{ parentUserId: user.id }, { studentUserId: user.id }] },
    });
    const adminAuditLogs = await tx.adminAuditLog.deleteMany({ where: { adminId: user.id } });

    await tx.user.delete({ where: { id: user.id } });

    return {
      fraudAlerts: fraudAlerts.count,
      transactions: txDeleted.count,
      virtualCards: virtualCards.count,
      budgetCategories: budgetCategories.count,
      lockedFunds: lockedFunds.count,
      wallets: walletsDeleted.count,
      academicDocuments: academicDocuments.count,
      notifications: notifications.count,
      supportMessages: supportMessages.count,
      parentalControls: parentalControls.count,
      adminAuditLogs: adminAuditLogs.count,
    };
  });

  console.log(`Deleted user ${TARGET_EMAIL} (id: ${user.id}) and associated data:`);
  console.table(result);
}

main()
  .catch((error) => {
    console.error('Failed to delete user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
