import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ScanLine, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { ProductThumbnail } from '../components/ProductThumbnail';

export function CartPage() {
  const { items, itemCount, subtotal, removeFromCart, updateQuantity } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  function handleRemove(id: string, name: string) {
    removeFromCart(id);
    showToast(`${name} removed from cart`, 'info');
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <ShoppingBag className="h-24 w-24 text-slate-300" strokeWidth={1} />
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-slate-500">Looks like you haven't added anything yet.</p>
        <Link
          to="/home"
          className="mt-6 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-baseline gap-2.5">
        <h1 className="text-2xl font-bold text-slate-900">Shopping Cart</h1>
        <span className="text-sm font-medium text-slate-500">
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
            >
              <ProductThumbnail
                src={item.image}
                alt={item.name}
                fit="contain"
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3F0FF] p-2 text-3xl"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{item.name}</h3>
                <p className="text-sm text-slate-500">{item.description}</p>
                <p className="mt-1 font-bold text-primary-600">${item.price.toFixed(2)}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 px-2 py-1">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-primary-600 transition hover:bg-primary-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center font-semibold text-slate-700">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-primary-600 transition hover:bg-primary-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => handleRemove(item.id, item.name)}
                className="ml-2 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove item"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)] lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
          <div className="mt-4 flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-900">
            <span>Total</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-primary-50 px-3 py-2.5 text-xs text-primary-700">
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0" />
            Your spending category will be detected automatically at checkout.
          </p>
          <button
            onClick={() => navigate('/checkout')}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:from-primary-700 hover:to-primary-600"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
