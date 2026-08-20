import { useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { ProductThumbnail } from './ProductThumbnail';

// "✓ Added" is a purely cosmetic confirmation on the button itself — the toast (already
// covering the "it worked" signal) keeps firing exactly as before.
const ADDED_FLASH_MS = 1200;

// These two product photos are wide, mostly-background card mockups that render tiny with
// letterboxing under object-contain — cover fills the box and reads far more clearly, and
// the crop cost is negligible since the card graphic sits centered with margin to spare.
const LARGER_IMAGE_PRODUCT_IDS = new Set(['taxi-app-credit', 'parking-season-pass']);

export function ProductCard({ product }: Readonly<{ product: Product }>) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [justAdded, setJustAdded] = useState(false);
  const useLargerImage = LARGER_IMAGE_PRODUCT_IDS.has(product.id);

  function handleAdd() {
    addToCart(product);
    showToast(`${product.name} added to cart`);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), ADDED_FLASH_MS);
  }

  return (
    <div className="group flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <ProductThumbnail
        src={product.image}
        alt={product.name}
        fit={useLargerImage ? 'cover' : 'contain'}
        className={`flex h-[220px] items-center justify-center overflow-hidden bg-white text-5xl ${
          useLargerImage ? '' : 'p-2'
        }`}
      />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-bold text-slate-900">{product.name}</h3>
        <p className="mt-1 flex-1 text-[13px] text-slate-500">{product.description}</p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
          }}
        >
          <span style={{ fontWeight: 700, color: '#7C3AED', fontSize: '16px' }}>
            ${product.price.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              width: 'auto',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              background: justAdded ? '#10B981' : 'linear-gradient(to right, #7C3AED, #8B5CF6)',
            }}
          >
            {justAdded ? (
              <>
                <Check size={12} /> Added
              </>
            ) : (
              <>
                <ShoppingCart size={12} /> Add to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
