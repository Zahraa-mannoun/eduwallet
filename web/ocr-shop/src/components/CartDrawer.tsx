import { useNavigate } from 'react-router-dom';
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
  const { items, subtotal, removeFromCart, updateQuantity } = useCart();
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
          <h2 className="text-lg font-bold text-slate-900">Your Cart</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="text-4xl">🛒</span>
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
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 text-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">${item.price.toFixed(2)} each</p>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-600 transition hover:bg-slate-100"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-600 transition hover:bg-slate-100"
                        >
                          +
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
                        className="text-xs text-slate-400 transition hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={goToCheckout}
                className="mt-3 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
              >
                Proceed to Checkout
              </button>
              <button
                type="button"
                onClick={goToFullCart}
                className="mt-2 w-full rounded-lg px-4 py-2 text-xs font-medium text-primary-600 transition hover:bg-primary-50"
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
