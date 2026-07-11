'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/api-client';
import { ApiError } from '@/lib/api-types';

/**
 * Public product listing — calls the real backend contract
 * (GET /api/v1/catalog/products, API Spec Volume 07 §5.2, FR-PRD-005
 * scope-reduced: active products only, cursor-paginated, no search/facets).
 * No auth needed — same "prove the contract end-to-end" pattern as the
 * other storefront pages.
 */
export default function ProductsPage() {
  const productsQuery = useQuery({
    queryKey: ['catalog-products'],
    queryFn: () => catalogApi.listProducts({ limit: 20 }),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Products</h1>

      {productsQuery.isLoading && <p>Loading products…</p>}

      {productsQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {productsQuery.error instanceof ApiError
            ? productsQuery.error.message
            : 'Failed to load products.'}
        </p>
      )}

      {productsQuery.data && productsQuery.data.data.length === 0 && (
        <p className="text-sm text-gray-600">No products available yet.</p>
      )}

      {productsQuery.data && productsQuery.data.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {productsQuery.data.data.map((product) => (
            <li
              key={product.id}
              className="flex flex-col gap-1 rounded border p-3"
            >
              <Link href={`/products/${product.id}`} className="font-medium underline">
                {product.title}
              </Link>
              <span className="text-sm text-gray-600">
                Status: <span className="capitalize">{product.status}</span>
                {product.isOrganicClaim && ' · Organic'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
