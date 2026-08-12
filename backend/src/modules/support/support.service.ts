import type { SupportMessage } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import { createNotification } from '../notifications/notifications.service';
import type {
  ReplySupportMessageInput,
  SendGeneralSupportMessageInput,
  SendSupportMessageInput,
} from './support.schema';

const supportMessageUserSelect = {
  select: { id: true, fullName: true, email: true, userType: true, suspended: true },
} as const;

export type SupportMessageRow = SupportMessage & {
  user: { id: string; fullName: string; email: string; userType: string; suspended: boolean };
};

export async function sendSupportMessage(input: SendSupportMessageInput): Promise<SupportMessage> {
  const sender = await prisma.user.findUnique({ where: { email: input.email } });
  if (!sender) {
    throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this email');
  }

  const message = await prisma.supportMessage.create({
    data: { userId: sender.id, message: input.message, type: 'SUSPENSION_APPEAL' },
  });

  const admins = await prisma.user.findMany({
    where: { userType: 'ADMIN' },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        admin.id,
        'New Support Message',
        `${sender.fullName} sent a support message.`,
        'SUPPORT_MESSAGE'
      )
    )
  );

  return message;
}

// Authenticated, any role — reached from Profile > Help & Support, unlike sendSupportMessage
// above which exists specifically for suspended users with no session at all.
export async function sendGeneralSupportMessage(
  userId: string,
  input: SendGeneralSupportMessageInput
): Promise<SupportMessage> {
  const sender = await prisma.user.findUnique({ where: { id: userId } });
  if (!sender) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const message = await prisma.supportMessage.create({
    data: { userId: sender.id, subject: input.subject, message: input.message, type: 'GENERAL' },
  });

  const admins = await prisma.user.findMany({
    where: { userType: 'ADMIN' },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        admin.id,
        'New Support Message',
        `${sender.fullName} sent a support message: ${input.subject}`,
        'SUPPORT_MESSAGE'
      )
    )
  );

  return message;
}

export async function getSupportMessages(): Promise<SupportMessageRow[]> {
  return prisma.supportMessage.findMany({
    include: { user: supportMessageUserSelect },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markSupportMessageRead(messageId: string): Promise<SupportMessage> {
  const message = await prisma.supportMessage.findUnique({ where: { id: messageId } });
  if (!message) {
    throw new AppError(404, 'SUPPORT_MESSAGE_NOT_FOUND', 'Support message not found');
  }

  return prisma.supportMessage.update({
    where: { id: messageId },
    data: { status: 'READ' },
  });
}

// Replying doesn't persist a reply on the SupportMessage row itself (there's no thread/reply
// field on the model) — it notifies the sender directly, same as every other "admin responds
// to a user" flow in the app (suspend reason, receipt review note, etc).
export async function replySupportMessage(
  messageId: string,
  input: ReplySupportMessageInput
): Promise<void> {
  const message = await prisma.supportMessage.findUnique({ where: { id: messageId } });
  if (!message) {
    throw new AppError(404, 'SUPPORT_MESSAGE_NOT_FOUND', 'Support message not found');
  }

  await createNotification(message.userId, 'Reply from Admin', input.message, 'SUPPORT_MESSAGE_REPLY');
}
