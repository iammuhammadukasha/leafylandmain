'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ordersApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';

/**
 * Cart page (Orders module, FR-ORD-001) — calls GET /api/v1/orders/cart,
 * PATCH/DELETE /api/v1/orders/cart/lines/:variantId, and
 * POST /api/v1/orders/checkout/quote to show a price/tax/shipping
 * breakdown before sending the user to /checkout. Auth-only, same
 * hasHydrated guard pattern as app/(vendor)/dashboard/page.tsx — waits
 * for zustand's persist rehydration before treating a null accessToken as
 * "not logged in" (a prior bug in this exact pattern was already fixed
 * elsewhere in this codebase; not reintroduced here).
 */
export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  const cartQuery = useQuery({
    queryKey: ['cart', accessToken],
    queryFn: () => ordersApi.getCart(accessToken as string),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const quoteQuery = useQuery({
    queryKey: ['checkout-quote', accessToken, cartQuery.data?.lines.length],
    queryFn: () => ordersApi.quoteCheckout(accessToken as string),
    enabled: Boolean(accessToken) && Boolean(cartQuery.data?.lines.length),
    retry: false,
  });

  const updateLine = useMutation({
    mutationFn: (params: { variantId: string; quantity: number }) =>
      ordersApi.updateCartLine(accessToken as string, params.variantId, {
        quantity: params.quantity,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeLine = useMutation({
    mutationFn: (variantId: string) =>
      ordersApi.removeCartLine(accessToken as string, variantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  if (!hasHydrated || !accessToken) {
    return null;
  }

  const money = (minor: string) => `₹${(Number(minor) / 100).toFixed(2)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Your cart</h1>

      {cartQuery.isLoading && <p>Loading cart…</p>}

      {cartQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {cartQuery.error instanceof ApiError
            ? cartQuery.error.message
            : 'Failed to load cart.'}
        </p>
      )}

      {cartQuery.data && cartQuery.data.lines.length === 0 && (
        <p className="text-sm text-gray-600">
          Your cart is empty.{' '}
          <Link href="/products" className="underline">
            Browse products
          </Link>
          .
        </p>
      )}

      {cartQuery.data && cartQuery.data.lines.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-1">Variant</th>
              <th className="py-1">Qty</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {cartQuery.data.lines.map((line) => (
              <tr key={line.productVariantId} className="border-b">
                <td className="py-1 font-mono text-xs">
                  {line.productVariantId}
                </td>
                <td className="py-1">
                  <input
                    type="number"
                    min={1}
                    defaultValue={line.quantity}
                    className="w-16 rounded border px-2 py-1"
                    onBlur={(e) => {
                      const quantity = Number(e.target.value);
                      if (quantity > 0 && quantity !== line.quantity) {
                        updateLine.mutate({
                          variantId: line.productVariantId,
                          quantity,
                        });
                      }
                    }}
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine.mutate(line.productVariantId)}
                    className="text-xs text-red-600 underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {quoteQuery.isLoading && <p>Calculating totals…</p>}

      {quoteQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {quoteQuery.error instanceof ApiError
            ? quoteQuery.error.message
            : 'Failed to compute checkout quote.'}
        </p>
      )}

      {quoteQuery.data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">Subtotal</dt>
          <dd>{money(quoteQuery.data.subtotalMinor)}</dd>
          <dt className="font-medium">Tax</dt>
          <dd>{money(quoteQuery.data.taxMinor)}</dd>
          <dt className="font-medium">Shipping</dt>
          <dd>{money(quoteQuery.data.shippingMinor)}</dd>
          <dt className="font-medium">Total</dt>
          <dd className="font-semibold">{money(quoteQuery.data.totalMinor)}</dd>
        </dl>
      )}

      {cartQuery.data && cartQuery.data.lines.length > 0 && (
        <Link
          href="/checkout"
          className="mt-2 w-fit rounded bg-green-700 px-4 py-2 text-sm font-medium text-white"
        >
          Proceed to checkout
        </Link>
      )}
    </main>
  );
}
