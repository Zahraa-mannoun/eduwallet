import { useMemo } from 'react';
import { SearchX, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { ProductCard } from '../components/ProductCard';
import { PRODUCTS } from '../data/products';

const HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=1600&q=80&auto=format&fit=crop';

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

  const resultsSummary = query.trim()
    ? `${filteredProducts.length} result${filteredProducts.length === 1 ? '' : 's'} for “${query.trim()}”`
    : `${filteredProducts.length} products available`;

  return (
    <div className="bg-[#FAFAFA]">
      <section
        className="relative flex min-h-[420px] items-center overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMAGE_URL})` }}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(109, 40, 217, 0.75)' }}
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <p className="text-lg font-medium text-white/90 sm:text-xl">
            Welcome back, {user?.fullName ?? 'student'}!
          </p>
          <h1 className="mt-1 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Everything a student needs, in one place
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/80 sm:text-base">
            Books, food, transport, and lifestyle essentials — curated for campus life and
            ready to ship to your door.
          </p>
          <a
            href="#product-grid"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-primary-700 shadow-lg transition hover:bg-white/90"
          >
            <ShoppingBag className="h-4 w-4" />
            Shop Now
          </a>
        </div>
      </section>

      <section id="product-grid" className="w-full py-10">
        <div className="flex flex-wrap items-end justify-between gap-3 px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900">All Products</h2>
              <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-bold text-primary-700">
                {filteredProducts.length}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{resultsSummary}</p>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <SearchX className="h-10 w-10 text-slate-300" />
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
          <div className="grid grid-cols-5 gap-4 px-6 py-8">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
