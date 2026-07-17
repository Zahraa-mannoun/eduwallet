import type { CategoryInfo } from '../types';

export const CATEGORIES: CategoryInfo[] = [
  { key: 'BOOKS', name: 'Books & Courses', image: '/images/category-books.png' },
  { key: 'FOOD', name: 'Food', image: '/images/category-food.png' },
  { key: 'SOFTWARE', name: 'Software', image: '/images/category-software.png' },
  { key: 'TRANSPORT', name: 'Transport', image: '/images/category-transport.png' },
  { key: 'TUITION', name: 'Tuition', image: '/images/category-tuition.jpeg' },
  { key: 'RENT', name: 'Rent', image: '/images/category-rent.jpeg' },
  { key: 'PERSONAL', name: 'Personal', image: '/images/category-personal.jpeg' },
];

export function getCategoryInfo(key: string): CategoryInfo | undefined {
  return CATEGORIES.find((c) => c.key === key);
}
