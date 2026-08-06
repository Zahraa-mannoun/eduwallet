import { api, unwrap } from './api';
import type { ApiResponse, Category, UseCardResponseData } from '../types';

export interface UseCardPayload {
  cardNumber: string;
  cvv: string;
  expiry: string;
  amount: number;
  category: Category;
}

// A card is single-use (the backend freezes/reissues it on charge), so a hung request here is
// especially confusing — the student can't tell whether it went through. Bound the wait instead
// of letting it hang indefinitely.
const CARD_PAYMENT_TIMEOUT_MS = 30_000;

export async function payWithCard(payload: UseCardPayload): Promise<UseCardResponseData> {
  const response = await api.post<ApiResponse<UseCardResponseData>>(
    '/cards/use',
    {
      cardNumber: payload.cardNumber,
      cvv: payload.cvv,
      expiry: payload.expiry,
      amount: payload.amount,
      currency: 'USD',
      merchantName: 'ScanMart',
      category: payload.category,
    },
    { timeout: CARD_PAYMENT_TIMEOUT_MS }
  );
  return unwrap(response.data);
}
