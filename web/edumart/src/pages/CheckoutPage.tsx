import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { CategoryPaymentPanel } from '../components/CategoryPaymentPanel';
import { categoryLabel } from '../lib/format';
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
const PAID_CATEGORIES_KEY = 'edumart_checkout_paid_categories';

function loadPaidCategories(): Set<Category> {
  try {
    const raw = sessionStorage.getItem(PAID_CATEGORIES_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed as Category[]);
  } catch {
    return new Set();
  }
}

function groupByCategory(items: CartItem[]): CategoryGroup[] {
  const map = new Map<Category, CartItem[]>();
  for (const item of items) {
    const existing = map.get(item.category) ?? [];
    existing.push(item);
    map.set(item.category, existing);
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
  const groups = useMemo(() => groupByCategory(checkoutItems), [checkoutItems]);
  const [paidCategories, setPaidCategories] = useState<Set<Category>>(loadPaidCategories);

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
      sessionStorage.setItem(PAID_CATEGORIES_KEY, JSON.stringify([...next]));
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>

      {groups.length > 1 && (
        <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          You have items in {groups.length} categories. Because EduWallet funds can be education-locked
          per category, you'll need to pay for each category separately with its own virtual card.
        </div>
      )}

      {allPaid && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <p className="text-lg font-bold text-emerald-700">All payments completed! 🎉</p>
          <Link
            to="/home"
            className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Back to Home
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
            <div className="mt-4 space-y-4">
              {groups.map((group) => (
                <div key={group.category}>
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>{categoryLabel(group.category)}</span>
                    <span>${group.subtotal.toFixed(2)}</span>
                  </div>
                  <ul className="mt-1 space-y-1">
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
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-base font-bold text-slate-900">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {groups.map((group, i) => (
            <CategoryPaymentPanel
              key={group.category}
              category={group.category}
              amount={group.subtotal}
              index={i + 1}
              onSuccess={() => handleGroupSuccess(group.category)}
              initiallyPaid={paidCategories.has(group.category)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
