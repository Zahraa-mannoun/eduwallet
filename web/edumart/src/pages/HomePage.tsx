import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { CategoryCard } from '../components/CategoryCard';
import { ProductCard } from '../components/ProductCard';
import { CATEGORIES } from '../data/categories';
import { getFeaturedProducts } from '../data/products';

export function HomePage() {
  const { user } = useAuth();
  const featured = useMemo(() => getFeaturedProducts(6), []);

  return (
    <div>
      <section className="relative overflow-hidden">
        <img
          src="/images/hero-banner.png"
          alt="EduMart"
          className="h-64 w-full object-cover sm:h-80"
        />
        <div className="absolute inset-0 flex items-center bg-gradient-to-r from-primary-900/70 via-primary-900/30 to-transparent">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-lg font-medium text-white/90 sm:text-xl">
              Welcome back, {user?.fullName ?? 'student'}!
            </p>
            <h1 className="mt-1 max-w-lg text-3xl font-bold text-white sm:text-4xl">
              Everything a student needs, one wallet away
            </h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-slate-900">Shop by Category</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {CATEGORIES.map((category) => (
            <CategoryCard key={category.key} category={category} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-slate-900">Featured Products</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
