import { Link } from 'react-router-dom';
import type { CategoryInfo } from '../types';
import { getProductsByCategory } from '../data/products';

export function CategoryCard({ category }: { category: CategoryInfo }) {
  const count = getProductsByCategory(category.key).length;

  return (
    <Link
      to={`/category/${category.key}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={category.image}
          alt={category.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-slate-900">{category.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{count} products</p>
        <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 transition group-hover:bg-primary-600 group-hover:text-white">
          Shop Now
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
