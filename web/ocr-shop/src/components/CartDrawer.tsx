import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { ProductThumbnail } from './ProductThumbnail';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// The header cart icon's quick-view — full item list, quantities, subtotal, and a straight
// path to checkout, without leaving whatever page the shopper was on. /cart (CartPage) stays
// reachable via "View full cart" below for anyone who wants the dedicated page instead.
export function CartDrawer({ isOpen, onClose }: Readonly<CartDrawerProps>) {
  const { items, itemCount, subtotal, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();

  function goToCheckout() {
    onClose();
    navigate('/checkout');
  }

  function goToFullCart() {
    onClose();
    navigate('/cart');
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-sm sm:rounded-none ${
          isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            Your Cart {itemCount > 0 && `(${itemCount} item${itemCount === 1 ? '' : 's'})`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-900">Your cart is empty</p>
            <p className="text-sm text-slate-500">Add a few products to get started.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <ProductThumbnail
                      src={item.image}
                      alt={item.name}
                      fit="contain"
                      className="flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F3F0FF] p-1 text-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">${item.price.toFixed(2)} each</p>
                      <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-primary-200 px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="flex h-5 w-5 items-center justify-center rounded-full text-primary-600 transition hover:bg-primary-50"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-4 text-center text-xs font-semibold text-slate-700">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="flex h-5 w-5 items-center justify-center rounded-full text-primary-600 transition hover:bg-primary-50"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-slate-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="text-xs font-medium text-red-500 transition hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between text-base font-bold text-slate-900">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={goToCheckout}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:from-primary-700 hover:to-primary-600"
              >
                Proceed to Checkout
              </button>
              <button
                type="button"
                onClick={goToFullCart}
                className="mt-2 w-full rounded-lg px-4 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                View full cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
