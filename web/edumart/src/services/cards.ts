import { api, unwrap } from './api';
import type { ApiResponse, Category, UseCardResponseData } from '../types';

export interface UseCardPayload {
  cardNumber: string;
  cvv: string;
  amount: number;
  category: Category;
}

export async function payWithCard(payload: UseCardPayload): Promise<UseCardResponseData> {
  const response = await api.post<ApiResponse<UseCardResponseData>>('/cards/use', {
    cardNumber: payload.cardNumber,
    cvv: payload.cvv,
    amount: payload.amount,
    currency: 'USD',
    merchantName: 'EduMart',
    category: payload.category,
  });
  return unwrap(response.data);
}
