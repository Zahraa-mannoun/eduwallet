import { useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

// "✓ Added" is a purely cosmetic confirmation on the button itself — the toast (already
// covering the "it worked" signal) keeps firing exactly as before.
const ADDED_FLASH_MS = 1200;
const CARD_BACKGROUND = '#F0EEFF';

export function ProductCard({ product }: Readonly<{ product: Product }>) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [justAdded, setJustAdded] = useState(false);
  // Local fallback state — this card renders its own <img> (rather than going through
  // ProductThumbnail) so every piece of the card can carry exact inline styles with no
  // Tailwind classes in the mix.
  const [imageFailed, setImageFailed] = useState(false);

  function handleAdd() {
    addToCart(product);
    showToast(`${product.name} added to cart`);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), ADDED_FLASH_MS);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: CARD_BACKGROUND,
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: CARD_BACKGROUND,
          height: '160px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
        }}
      >
        {imageFailed ? (
          <span style={{ fontSize: '40px' }}>📦</span>
        ) : (
          <img
            src={product.image}
            alt={product.name}
            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      <div style={{ background: CARD_BACKGROUND, padding: '12px 16px' }}>
        <h3
          style={{
            fontWeight: 700,
            color: '#0F172A',
            fontSize: '14px',
            marginBottom: '4px',
          }}
        >
          {product.name}
        </h3>
        <p
          style={{
            color: '#64748B',
            fontSize: '12px',
            marginBottom: '8px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.description}
        </p>
        <div
          style={{
            fontWeight: 700,
            color: '#7C3AED',
            fontSize: '16px',
            marginBottom: '10px',
          }}
        >
          ${product.price.toFixed(2)}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            borderRadius: '8px',
            fontSize: '13px',
            padding: '8px',
            fontWeight: 700,
            color: '#FFFFFF',
            border: 'none',
            cursor: 'pointer',
            background: justAdded ? '#10B981' : 'linear-gradient(to right, #7C3AED, #8B5CF6)',
          }}
        >
          {justAdded ? (
            <>
              <Check size={14} /> Added
            </>
          ) : (
            <>
              <ShoppingCart size={14} /> Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
