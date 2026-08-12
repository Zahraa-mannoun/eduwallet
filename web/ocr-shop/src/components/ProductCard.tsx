import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { CATEGORY_META, detectCategory } from '../lib/ocr';
import { ProductThumbnail } from './ProductThumbnail';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const category = detectCategory(`${product.name} ${product.description}`);
  const meta = CATEGORY_META[category];

  function handleAdd() {
    addToCart(product);
    showToast(`${product.name} added to cart`);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg">
      <div className="relative">
        <ProductThumbnail
          src={product.image}
          alt={product.name}
          className="flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-primary-100 to-primary-50 text-5xl"
        />
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur">
          {meta.emoji} {meta.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 font-semibold text-slate-900">{product.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{product.description}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-primary-700">${product.price.toFixed(2)}</span>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 hover:shadow active:scale-95"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
