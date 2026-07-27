import type { SupportMessage } from '../types/api';
import { apiRequest } from './api';

// Public endpoint — a suspended user has no access token at all (login rejects suspended
// accounts before ever issuing one), so this must never attach an Authorization header.
export async function sendSupportMessage(email: string, message: string): Promise<SupportMessage> {
  return apiRequest<SupportMessage>('/support/message', {
    method: 'POST',
    body: { email, message },
    auth: false,
  });
}
