import { Link, Navigate, useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { getCategoryInfo } from '../data/categories';
import { getProductsByCategory } from '../data/products';

export function CategoryPage() {
  const { name } = useParams<{ name: string }>();
  const category = getCategoryInfo(name ?? '');

  if (!category) {
    return <Navigate to="/home" replace />;
  }

  const products = getProductsByCategory(category.key);

  return (
    <div>
      <section className="relative overflow-hidden">
        <img src={category.image} alt={category.name} className="h-48 w-full object-cover sm:h-56" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-primary-900/70 to-transparent">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-white">{category.name}</h1>
            <p className="mt-1 text-sm text-white/80">{products.length} products</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          to="/home"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
