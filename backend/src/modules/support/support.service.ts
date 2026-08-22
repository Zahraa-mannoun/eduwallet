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
  // Reply text/date is never stored on the SupportMessage row itself (see replySupportMessage
  // below) — looked up from the SUPPORT_MESSAGE_REPLY notification it created, keyed by
  // relatedId, so the admin's own message list can show whether (and what) it already replied.
  replyMessage: string | null;
  repliedAt: string | null;
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
  const messages = await prisma.supportMessage.findMany({
    include: { user: supportMessageUserSelect },
    orderBy: { createdAt: 'desc' },
  });

  const replies = await prisma.notification.findMany({
    where: {
      type: 'SUPPORT_MESSAGE_REPLY',
      relatedId: { in: messages.map((message) => message.id) },
    },
    orderBy: { createdAt: 'desc' },
  });
  // A message could in principle pick up more than one reply row — keep only the most recent.
  // replies is already newest-first, so the first one seen per relatedId wins.
  const replyByMessageId = new Map<string, (typeof replies)[number]>();
  for (const reply of replies) {
    if (reply.relatedId && !replyByMessageId.has(reply.relatedId)) {
      replyByMessageId.set(reply.relatedId, reply);
    }
  }

  return messages.map((message) => {
    const reply = replyByMessageId.get(message.id);
    return {
      ...message,
      replyMessage: reply?.message ?? null,
      repliedAt: reply ? reply.createdAt.toISOString() : null,
    };
  });
}

export async function markSupportMessageRead(messageId: string): Promise<SupportMessage> {
  const message = await prisma.supportMessage.findUnique({ where: { id: messageId } });
  if (!message) {
    throw new AppError(404, 'SUPPORT_MESSAGE_NOT_FOUND', 'Support message not found');
  }

  const updated = await prisma.supportMessage.update({
    where: { id: messageId },
    data: { status: 'READ' },
  });

  // Same mechanism every other "something changed" refetch in the app relies on: creating a
  // notification also emits notification:new over the sender's socket room (see
  // notifications.service's createNotification / notifications.socket's emitNotification), which
  // is exactly what the agent portal's useSocketRefetch(load) on Messages.tsx is already
  // listening for. Without this, marking a message read only updated the DB — nothing told the
  // sender's already-open tab to refetch, so their own message list kept showing "Unread" until
  // a manual reload.
  await createNotification(
    updated.userId,
    'Message Read',
    'Your message has been read by the admin team.',
    'SUPPORT_MESSAGE_READ'
  );

  return updated;
}

// Replying doesn't persist a reply on the SupportMessage row itself (there's no thread/reply
// field on the model) — it notifies the sender directly, same as every other "admin responds
// to a user" flow in the app (suspend reason, receipt review note, etc). The notification's
// relatedId is set to the original message's id so a UI can thread the reply back under it.
export async function replySupportMessage(
  messageId: string,
  input: ReplySupportMessageInput
): Promise<void> {
  const message = await prisma.supportMessage.findUnique({ where: { id: messageId } });
  if (!message) {
    throw new AppError(404, 'SUPPORT_MESSAGE_NOT_FOUND', 'Support message not found');
  }

  await createNotification(
    message.userId,
    'Reply from Admin',
    input.message,
    'SUPPORT_MESSAGE_REPLY',
    messageId
  );
}
