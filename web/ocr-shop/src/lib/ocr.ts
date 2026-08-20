import type { Category } from '../types';

// Client-side "OCR" — a rule-based keyword scan over product name + description, standing in
// for real receipt text extraction (same demo convention as the backend's withdrawal-receipt
// OCR: no ML, just keyword matching against a fixed list per category).
const KEYWORDS: Record<Category, string[]> = {
  FOOD: ['coffee', 'pasta', 'juice', 'food', 'meal', 'grocery', 'restaurant', 'cafe', 'drink', 'fresh', 'organic'],
  BOOKS: ['programming', 'textbook', 'mathematics', 'academic', 'writing', 'guide', 'handbook', 'book', 'course', 'study'],
  SOFTWARE: ['license', 'software', 'cloud', 'storage', 'developer', 'tools', 'suite', 'design', 'subscription', 'app'],
  TRANSPORT: ['bus', 'pass', 'taxi', 'parking', 'metro', 'fuel', 'transport', 'ride', 'monthly'],
  LIFESTYLE: ['skincare', 'fashion', 'accessories', 'wellness', 'beauty', 'cosmetics', 'clothing', 'pharmacy'],
  TUITION: ['tuition', 'enrollment', 'registration', 'university', 'semester', 'fee', 'academic'],
  GENERAL: ['starter', 'essential', 'campus', 'kit', 'bundle'],
};

const CATEGORY_ORDER: Category[] = ['FOOD', 'BOOKS', 'SOFTWARE', 'TRANSPORT', 'LIFESTYLE', 'TUITION', 'GENERAL'];

export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  FOOD: { label: 'Food', emoji: '🍕' },
  BOOKS: { label: 'Books', emoji: '📚' },
  SOFTWARE: { label: 'Software', emoji: '💻' },
  TRANSPORT: { label: 'Transport', emoji: '🚌' },
  LIFESTYLE: { label: 'Lifestyle', emoji: '💄' },
  TUITION: { label: 'Tuition', emoji: '🎓' },
  GENERAL: { label: 'General', emoji: '🎒' },
};

// Storefront-only presentation metadata (badge colors, browse pill order) layered on top of
// the detection logic above — purely cosmetic, no effect on which category a purchase resolves to.
export const CATEGORY_BADGE_STYLES: Record<Category, { bg: string; text: string; ring: string }> = {
  BOOKS: { bg: 'bg-primary-600', text: 'text-white', ring: 'ring-primary-200' },
  FOOD: { bg: 'bg-emerald-500', text: 'text-white', ring: 'ring-emerald-200' },
  TRANSPORT: { bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-200' },
  LIFESTYLE: { bg: 'bg-orange-500', text: 'text-white', ring: 'ring-orange-200' },
  SOFTWARE: { bg: 'bg-sky-500', text: 'text-white', ring: 'ring-sky-200' },
  TUITION: { bg: 'bg-rose-500', text: 'text-white', ring: 'ring-rose-200' },
  GENERAL: { bg: 'bg-slate-500', text: 'text-white', ring: 'ring-slate-200' },
};

// The subset of categories worth browsing by on the storefront (a shopper never needs a
// "Tuition" or "General" pill — those exist only so checkout can still label an odd cart).
export const BROWSE_CATEGORIES: Category[] = ['BOOKS', 'FOOD', 'TRANSPORT', 'LIFESTYLE', 'SOFTWARE'];

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((total, keyword) => {
    let hits = 0;
    let index = lower.indexOf(keyword);
    while (index !== -1) {
      hits += 1;
      index = lower.indexOf(keyword, index + keyword.length);
    }
    return total + hits;
  }, 0);
}

// Category with the most keyword hits wins. A tie between two or more categories (including
// the all-zero "nothing matched" case, which is a tie across all seven) falls back to GENERAL.
export function detectCategory(text: string): Category {
  const scores = CATEGORY_ORDER.map((category) => ({
    category,
    hits: countKeywordHits(text, KEYWORDS[category]),
  }));
  const maxHits = Math.max(...scores.map((score) => score.hits));
  const topCategories = scores.filter((score) => score.hits === maxHits);
  return topCategories.length === 1 ? topCategories[0].category : 'GENERAL';
}

export function detectCategoryForItems(
  items: Array<{ name: string; description: string }>
): Category {
  const combinedText = items.map((item) => `${item.name} ${item.description}`).join(' ');
  return detectCategory(combinedText);
}
