import { BookOpen, Bus, GraduationCap, Laptop, Package, Shirt, Utensils, type LucideIcon } from 'lucide-react';
import type { Category } from '../types';
import { CATEGORY_BADGE_STYLES, CATEGORY_META } from '../lib/ocr';

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  BOOKS: BookOpen,
  FOOD: Utensils,
  TRANSPORT: Bus,
  LIFESTYLE: Shirt,
  SOFTWARE: Laptop,
  TUITION: GraduationCap,
  GENERAL: Package,
};

interface CategoryBadgeProps {
  category: Category;
  size?: 'sm' | 'md';
  className?: string;
}

export function CategoryBadge({ category, size = 'sm', className = '' }: Readonly<CategoryBadgeProps>) {
  const meta = CATEGORY_META[category];
  const style = CATEGORY_BADGE_STYLES[category];
  const Icon = CATEGORY_ICONS[category];
  const sizing = size === 'sm' ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-3 py-1 text-xs';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold shadow-sm ${sizing} ${style.bg} ${style.text} ${className}`}
    >
      <Icon size={iconSize} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}
