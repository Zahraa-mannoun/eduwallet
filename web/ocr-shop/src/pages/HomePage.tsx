import { useAuth } from '../context/AuthContext';
import { ProductCard } from '../components/ProductCard';
import { PRODUCTS } from '../data/products';

export function HomePage() {
  const { user } = useAuth();

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
        <h2 className="text-xl font-bold text-slate-900">All Products</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
