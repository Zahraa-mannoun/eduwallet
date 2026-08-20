import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { OcrPaymentPanel } from '../components/OcrPaymentPanel';
import { CategoryBadge } from '../components/CategoryBadge';
import { detectCategoryForItems } from '../lib/ocr';
import type { Category, CartItem } from '../types';

interface CategoryGroup {
  category: Category;
  items: CartItem[];
  subtotal: number;
}

// A virtual card is single-use — once a category is paid, its card is already frozen/reissued
// server-side. Without this, refreshing or navigating away mid-checkout (after paying for one
// of several categories) would re-render that category's payment form and re-demand payment.
// Cleared once every category is paid (see handleGroupSuccess) so it doesn't bleed into an
// unrelated later checkout.
const PAID_CATEGORIES_KEY = 'ocrshop_checkout_paid_categories';

// Identifies the exact cart contents a stored "paid" record applies to. If the cart changes
// (items added/removed, quantities changed) between an abandoned partial checkout and a
// later visit, the signature won't match and the stale record is discarded — otherwise a
// category paid for in one cart would incorrectly be treated as already paid in a
// different, later cart that happens to reuse the same category.
function cartSignature(items: CartItem[]): string {
  return items
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join('|');
}

function loadPaidCategories(signature: string): Set<Category> {
  try {
    const raw = sessionStorage.getItem(PAID_CATEGORIES_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { signature?: unknown }).signature !== signature ||
      !Array.isArray((parsed as { categories?: unknown }).categories)
    ) {
      return new Set();
    }
    return new Set((parsed as { categories: Category[] }).categories);
  } catch {
    return new Set();
  }
}

// Each item is scanned individually (name + description) to decide which group it belongs
// to — a cart with items detected into different categories ends up as separate groups here,
// exactly like EduMart's static per-item category, just computed instead of predefined.
function groupByDetectedCategory(items: CartItem[]): CategoryGroup[] {
  const map = new Map<Category, CartItem[]>();
  for (const item of items) {
    const category = detectCategoryForItems([item]);
    const existing = map.get(category) ?? [];
    existing.push(item);
    map.set(category, existing);
  }
  return Array.from(map.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
    subtotal: categoryItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }));
}

export function CheckoutPage() {
  const { items, clearCart } = useCart();
  // Snapshot the cart at entry so clearing it on final success doesn't blank this page mid-flow.
  const [checkoutItems] = useState<CartItem[]>(items);
  const groups = useMemo(() => groupByDetectedCategory(checkoutItems), [checkoutItems]);
  const signature = useMemo(() => cartSignature(checkoutItems), [checkoutItems]);
  const [paidCategories, setPaidCategories] = useState<Set<Category>>(() =>
    loadPaidCategories(signature)
  );

  if (checkoutItems.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const grandTotal = groups.reduce((sum, group) => sum + group.subtotal, 0);
  const allPaid = paidCategories.size === groups.length;

  function handleGroupSuccess(category: Category) {
    const next = new Set(paidCategories);
    next.add(category);
    setPaidCategories(next);
    if (next.size === groups.length) {
      clearCart();
      sessionStorage.removeItem(PAID_CATEGORIES_KEY);
    } else {
      sessionStorage.setItem(
        PAID_CATEGORIES_KEY,
        JSON.stringify({ signature, categories: [...next] })
      );
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>

      {groups.length > 1 && (
        <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          Your cart spans {groups.length} categories, so you&apos;ll need to pay for each one
          separately with its own virtual card.
        </div>
      )}

      {allPaid && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <p className="flex items-center gap-2 text-lg font-bold text-emerald-700">
            <PartyPopper className="h-5 w-5" /> All payments completed!
          </p>
          <Link
            to="/home"
            className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Back to Home
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:sticky lg:top-20 lg:col-span-1 lg:self-start">
          <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
            <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
            <div className="mt-4 space-y-4">
              {groups.map((group) => (
                <div key={group.category}>
                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={group.category} size="md" />
                    <span className="text-sm font-semibold text-slate-700">
                      ${group.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex justify-between text-xs text-slate-500">
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-900">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {groups.map((group, i) => (
            <OcrPaymentPanel
              key={group.category}
              category={group.category}
              amount={group.subtotal}
              index={i + 1}
              totalPanels={groups.length}
              onSuccess={() => handleGroupSuccess(group.category)}
              initiallyPaid={paidCategories.has(group.category)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
