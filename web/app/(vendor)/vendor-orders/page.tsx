'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vendorOrdersApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';
import type { VendorOrderLineResponse } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Vendor order fulfillment (FR-ORD-006, API Spec Volume 07 §6.3) — lists
 * the caller's own order lines (GET /api/v1/vendors/me/orders, across all
 * buyers' orders) with ship/deliver action buttons. Follows the same
 * conventions as vendor-products/page.tsx: TanStack Query, ApiError
 * handling, the hasHydrated auth-store pattern.
 *
 * Route is `/vendor-orders`, not `/orders`, for the same reason
 * vendor-products isn't at `/products` — the (vendor) and (storefront)
 * route groups both flatten out of the URL and would collide if this used
 * a bare `/orders` path (no storefront `/orders` page exists yet, but the
 * naming stays consistent with vendor-products either way).
 */
export default function VendorOrdersPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const queryClient = useQueryClient();

  const [shipFormFor, setShipFormFor] = useState<string | null>(null);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  const orderLinesQuery = useQuery({
    queryKey: ['vendor-order-lines', accessToken],
    queryFn: () =>
      vendorOrdersApi.listMyOrderLines(accessToken as string, { page: 1, pageSize: 50 }),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const shipMutation = useMutation({
    mutationFn: (orderLineId: string) => {
      if (!accessToken) throw new Error('Not authenticated.');
      return vendorOrdersApi.shipOrderLine(accessToken, orderLineId, {
        carrier,
        trackingNumber,
      });
    },
    onSuccess: () => {
      setShipFormFor(null);
      setCarrier('');
      setTrackingNumber('');
      void queryClient.invalidateQueries({ queryKey: ['vendor-order-lines'] });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: (orderLineId: string) => {
      if (!accessToken) throw new Error('Not authenticated.');
      return vendorOrdersApi.deliverOrderLine(accessToken, orderLineId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-order-lines'] });
    },
  });

  if (!hasHydrated || !accessToken) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">My Orders</h1>
      <p className="text-sm text-gray-600">
        Order lines across all buyers, scoped to your vendor account
        (FR-ORD-006).
      </p>

      {orderLinesQuery.isLoading && <p>Loading orders…</p>}

      {orderLinesQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {orderLinesQuery.error instanceof ApiError
            ? orderLinesQuery.error.message
            : 'Failed to load orders.'}
        </p>
      )}

      {orderLinesQuery.data && orderLinesQuery.data.data.length === 0 && (
        <p className="text-sm text-gray-600">No order lines yet.</p>
      )}

      {orderLinesQuery.data && orderLinesQuery.data.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {orderLinesQuery.data.data.map((line) => (
            <li
              key={line.orderLineId}
              className="flex flex-col gap-2 rounded border p-3"
            >
              {renderLineRow(line)}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={
                    line.lineStatus !== 'pending' || shipMutation.isPending
                  }
                  onClick={() =>
                    setShipFormFor(
                      shipFormFor === line.orderLineId
                        ? null
                        : line.orderLineId,
                    )
                  }
                >
                  {line.shipmentStatus ? 'Update shipment' : 'Ship'}
                </Button>
                <Button
                  type="button"
                  disabled={
                    line.shipmentStatus !== 'shipped' ||
                    deliverMutation.isPending
                  }
                  onClick={() => deliverMutation.mutate(line.orderLineId)}
                >
                  Mark delivered
                </Button>
              </div>

              {shipFormFor === line.orderLineId && (
                <form
                  className="flex flex-col gap-2 rounded bg-gray-50 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    shipMutation.mutate(line.orderLineId);
                  }}
                >
                  <label className="flex flex-col gap-1 text-sm">
                    Carrier
                    <Input
                      type="text"
                      required
                      maxLength={200}
                      value={carrier}
                      onChange={(event) => setCarrier(event.target.value)}
                      placeholder="e.g. BlueDart"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Tracking number
                    <Input
                      type="text"
                      required
                      maxLength={200}
                      value={trackingNumber}
                      onChange={(event) =>
                        setTrackingNumber(event.target.value)
                      }
                    />
                  </label>
                  <Button type="submit" disabled={shipMutation.isPending}>
                    {shipMutation.isPending ? 'Shipping…' : 'Confirm ship'}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {(shipMutation.isError || deliverMutation.isError) && (
        <p className="text-sm text-red-600" role="alert">
          {(shipMutation.error ?? deliverMutation.error) instanceof ApiError
            ? ((shipMutation.error ?? deliverMutation.error) as ApiError)
                .message
            : 'Action failed.'}
        </p>
      )}
    </main>
  );
}

function renderLineRow(line: VendorOrderLineResponse) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col text-sm">
        <span className="font-medium">
          Order {line.orderId.slice(0, 8)}… · Qty {line.quantity}
        </span>
        <span className="text-gray-600">
          Variant {line.productVariantId.slice(0, 8)}… ·{' '}
          {(Number(line.unitPriceMinor) / 100).toFixed(2)} per unit
        </span>
      </div>
      <div className="flex flex-col items-end text-sm capitalize">
        <span>{line.lineStatus}</span>
        <span className="text-gray-600">
          {line.shipmentStatus ? `shipment: ${line.shipmentStatus}` : 'not shipped'}
        </span>
      </div>
    </div>
  );
}
