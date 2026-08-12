import type { SupportMessage } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { createNotification } from '../notifications/notifications.service';
import type { SendAgentMessageInput } from './agent.schema';

function formatMoney(amount: number | string | { toString(): string }): string {
  return Number(amount.toString()).toFixed(2);
}

export type AgentStats = {
  withdrawalsToday: number;
  withdrawalsThisMonth: number;
  totalDispensedToday: string;
  totalDispensedThisMonth: string;
};

export async function getAgentStats(agentId: string): Promise<AgentStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayAgg, monthAgg] = await Promise.all([
    prisma.withdrawalRequest.aggregate({
      where: { agentId, status: 'COMPLETED', completedAt: { gte: todayStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.withdrawalRequest.aggregate({
      where: { agentId, status: 'COMPLETED', completedAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    withdrawalsToday: todayAgg._count,
    withdrawalsThisMonth: monthAgg._count,
    totalDispensedToday: formatMoney(todayAgg._sum.amount ?? 0),
    totalDispensedThisMonth: formatMoney(monthAgg._sum.amount ?? 0),
  };
}

export async function sendAgentMessage(
  agentId: string,
  input: SendAgentMessageInput
): Promise<SupportMessage> {
  const sender = await prisma.user.findUnique({ where: { id: agentId } });
  if (!sender) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const message = await prisma.supportMessage.create({
    data: { userId: sender.id, subject: input.subject, message: input.message, type: 'AGENT_MESSAGE' },
  });

  const admins = await prisma.user.findMany({
    where: { userType: 'ADMIN' },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        admin.id,
        'New Agent Message',
        `${sender.fullName} sent a message: ${input.subject}`,
        'AGENT_MESSAGE'
      )
    )
  );

  return message;
}

export async function getMyAgentMessages(agentId: string): Promise<SupportMessage[]> {
  return prisma.supportMessage.findMany({
    where: { userId: agentId, type: 'AGENT_MESSAGE' },
    orderBy: { createdAt: 'desc' },
  });
}
