import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { ProductCard } from '../components/ProductCard';
import { PRODUCTS } from '../data/products';

export function HomePage() {
  const { user } = useAuth();
  const { query, setQuery } = useSearch();

  const filteredProducts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return PRODUCTS;
    return PRODUCTS.filter(
      (product) =>
        product.name.toLowerCase().includes(trimmed) ||
        product.description.toLowerCase().includes(trimmed)
    );
  }, [query]);

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-r from-primary-900 via-primary-700 to-primary-500">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-lg font-medium text-white/90 sm:text-xl">
            Welcome back, {user?.fullName ?? 'student'}!
          </p>
          <h1 className="mt-1 max-w-2xl text-3xl font-bold text-white sm:text-4xl">
            One catalog, no categories — our AI figures out the rest
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
            ScanMart doesn&apos;t sort products by category. At checkout, our AI scans your cart
            and automatically routes each purchase to the right EduWallet card.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">All Products</h2>
          {query.trim() && (
            <p className="text-sm text-slate-500">
              {filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'} for
              &ldquo;{query.trim()}&rdquo;
            </p>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
            <span className="text-4xl">🔍</span>
            <p className="font-semibold text-slate-900">No products found</p>
            <p className="text-sm text-slate-500">
              We couldn&apos;t find anything matching &ldquo;{query.trim()}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
