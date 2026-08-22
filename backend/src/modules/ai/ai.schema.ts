import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(chatMessageSchema).max(20).optional().default([]),
});

export type AIChatInput = z.infer<typeof aiChatSchema>;
