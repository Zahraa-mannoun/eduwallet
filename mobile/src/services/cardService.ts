import type { Currency, NewVirtualCard, TransactionCategory, VirtualCard } from '../types/api';
import { apiRequest } from './api';

export type CreateCardInput = {
  categoryLock?: TransactionCategory;
  merchantLock?: string;
  expiryDays?: number;
};

export async function createCard(input: CreateCardInput = {}): Promise<NewVirtualCard> {
  return apiRequest<NewVirtualCard>('/cards', { method: 'POST', body: input });
}

export async function getCards(): Promise<VirtualCard[]> {
  return apiRequest<VirtualCard[]>('/cards');
}

export async function getCardById(id: string): Promise<VirtualCard> {
  return apiRequest<VirtualCard>(`/cards/${id}`);
}

export async function freezeCard(id: string): Promise<VirtualCard> {
  return apiRequest<VirtualCard>(`/cards/${id}/freeze`, { method: 'PATCH' });
}

export async function deleteCard(id: string): Promise<{ message: string }> {
  return apiRequest(`/cards/${id}`, { method: 'DELETE' });
}

// Simulates a merchant checkout — card number + CVV are the credential, no session token.
export type UseCardInput = {
  cardNumber: string;
  cvv: string;
  amount: number;
  currency: Currency;
  merchantName: string;
  category: TransactionCategory;
};

export async function useCard(input: UseCardInput) {
  return apiRequest('/cards/use', { method: 'POST', body: input, auth: false });
}
