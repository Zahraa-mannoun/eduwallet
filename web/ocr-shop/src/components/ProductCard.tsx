import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { ProductThumbnail } from './ProductThumbnail';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const { showToast } = useToast();

  function handleAdd() {
    addToCart(product);
    showToast(`${product.name} added to cart`);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <ProductThumbnail
        src={product.image}
        alt={product.name}
        className="flex aspect-square items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50 text-5xl"
      />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-slate-900">{product.name}</h3>
        <p className="mt-1 flex-1 text-sm text-slate-500">{product.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-primary-600">${product.price.toFixed(2)}</span>
          <button
            onClick={handleAdd}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-700 active:scale-95"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
