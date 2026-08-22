import { apiRequest } from './api';

export type AIHealthLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export type AIInsights = {
  healthScore: number;
  healthLabel: AIHealthLabel;
  summary: string;
  recommendations: string[];
  predictions: Array<{ category: string; predictedAmount: number }>;
};

export async function getAIInsights(): Promise<AIInsights> {
  return apiRequest<AIInsights>('/ai/insights');
}
