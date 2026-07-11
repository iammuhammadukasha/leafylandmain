'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, ordersApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';

/**
 * Public product detail — calls GET /api/v1/catalog/products/:id and
 * GET /api/v1/catalog/products/:id/variants (API Spec Volume 07 §5.2,
 * FR-PRD-002). Draft/delisted products 404 for a non-owner caller, which
 * this page surfaces as a plain "not found" message (no special-casing —
 * the backend already enforces the rule, per Volume 04 §5 note).
 *
 * "Add to cart" (Orders module, FR-ORD-001) is Auth-only for this slice —
 * an unauthenticated visitor sees a "log in to add to cart" prompt instead
 * of a disabled button, matching the "Auth-only cart, guest cart deferred"
 * scope reduction documented in server/prisma/schema.prisma's Orders
 * context header comment.
 */
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);

  const productQuery = useQuery({
    queryKey: ['catalog-product', productId],
    queryFn: () => catalogApi.getProduct(productId),
    retry: false,
  });

  const variantsQuery = useQuery({
    queryKey: ['catalog-product-variants', productId],
    queryFn: () => catalogApi.getProductVariants(productId),
    enabled: productQuery.isSuccess,
    retry: false,
  });

  const addToCart = useMutation({
    mutationFn: (variantId: string) =>
      ordersApi.addCartLine(accessToken as string, {
        productVariantId: variantId,
        quantity: 1,
      }),
    onSuccess: (_cart, variantId) => {
      setAddedVariantId(variantId);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      {productQuery.isLoading && <p>Loading product…</p>}

      {productQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {productQuery.error instanceof ApiError &&
          productQuery.error.code === 'NOT_FOUND'
            ? 'This product is not available.'
            : 'Failed to load product.'}
        </p>
      )}

      {productQuery.data && (
        <>
          <h1 className="text-2xl font-semibold">{productQuery.data.title}</h1>
          <p className="text-sm text-gray-600">
            {productQuery.data.description ?? 'No description.'}
          </p>
          {productQuery.data.isOrganicClaim && (
            <span className="w-fit rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
              Organic certified
            </span>
          )}

          <h2 className="mt-4 text-lg font-medium">Variants</h2>
          {variantsQuery.isLoading && <p>Loading variants…</p>}
          {variantsQuery.data && variantsQuery.data.length === 0 && (
            <p className="text-sm text-gray-600">No variants listed.</p>
          )}
          {variantsQuery.data && variantsQuery.data.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1">SKU</th>
                  <th className="py-1">Price</th>
                  <th className="py-1">Stock</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {variantsQuery.data.map((variant) => (
                  <tr key={variant.id} className="border-b">
                    <td className="py-1">{variant.sku}</td>
                    <td className="py-1">
                      &#8377;{(Number(variant.priceMinor) / 100).toFixed(2)}
                    </td>
                    <td className="py-1">{variant.stockQuantity}</td>
                    <td className="py-1 text-right">
                      {!hasHydrated ? null : accessToken ? (
                        <button
                          type="button"
                          disabled={
                            addToCart.isPending || variant.stockQuantity === 0
                          }
                          onClick={() => addToCart.mutate(variant.id)}
                          className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {addedVariantId === variant.id
                            ? 'Added'
                            : 'Add to cart'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => router.push('/login')}
                          className="text-xs underline"
                        >
                          Log in to add to cart
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {addToCart.isError && (
            <p className="text-sm text-red-600" role="alert">
              {addToCart.error instanceof ApiError
                ? addToCart.error.message
                : 'Failed to add to cart.'}
            </p>
          )}

          {accessToken && (
            <a href="/cart" className="mt-2 w-fit text-sm underline">
              View cart
            </a>
          )}
        </>
      )}
    </main>
  );
}
