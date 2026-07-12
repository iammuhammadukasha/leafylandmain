'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi, returnsApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';
import type { OrderLineResponse } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Storefront order lookup + return request (FR-ORD-005, API Spec Volume 07
 * §6.2/§6.4). Minimal reasonable page per the task brief: there is no
 * dedicated "my orders" list yet (FR-USR-004's GET /users/me/orders is not
 * wired — see ordersApi in api-client.ts, only GET /orders/:orderId
 * exists), so this is an order-lookup-by-id page rather than a list. The
 * buyer pastes/is linked to an order id (e.g. from the checkout
 * confirmation, out of scope to build here) and can request a return on
 * any `fulfilled` line from here.
 *
 * Same hasHydrated auth-store pattern and TanStack Query/ApiError
 * conventions as account/page.tsx and vendor-orders/page.tsx.
 */
export default function OrdersLookupPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const queryClient = useQueryClient();

  const [orderIdInput, setOrderIdInput] = useState('');
  const [lookedUpOrderId, setLookedUpOrderId] = useState<string | null>(null);
  const [returnFormFor, setReturnFormFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  const orderQuery = useQuery({
    queryKey: ['order', lookedUpOrderId, accessToken],
    queryFn: () =>
      ordersApi.getOrder(accessToken as string, lookedUpOrderId as string),
    enabled: Boolean(accessToken) && Boolean(lookedUpOrderId),
    retry: false,
  });

  const requestReturnMutation = useMutation({
    mutationFn: (orderLineId: string) => {
      if (!accessToken) throw new Error('Not authenticated.');
      return returnsApi.requestReturn(accessToken, orderLineId, { reason });
    },
    onSuccess: () => {
      setReturnFormFor(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['order', lookedUpOrderId] });
    },
  });

  if (!hasHydrated || !accessToken) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">My Orders</h1>
      <p className="text-sm text-gray-600">
        Look up an order by id to view its lines and request a return
        (FR-ORD-005) on anything already delivered.
      </p>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setLookedUpOrderId(orderIdInput.trim() || null);
        }}
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Order ID
          <Input
            type="text"
            required
            value={orderIdInput}
            onChange={(event) => setOrderIdInput(event.target.value)}
            placeholder="e.g. ef100484-ffdd-46e4-919a-5cefef4c6b1a"
          />
        </label>
        <Button type="submit">Look up</Button>
      </form>

      {orderQuery.isLoading && <p>Loading order…</p>}

      {orderQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {orderQuery.error instanceof ApiError
            ? orderQuery.error.message
            : 'Failed to load order.'}
        </p>
      )}

      {orderQuery.data && (
        <div className="flex flex-col gap-3">
          <div className="rounded border p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Order {orderQuery.data.id}</span>
              <span className="capitalize">{orderQuery.data.status}</span>
            </div>
            <div className="text-gray-600">
              Total {(Number(orderQuery.data.totalMinor) / 100).toFixed(2)}
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {orderQuery.data.lines.map((line) => (
              <li key={line.id} className="flex flex-col gap-2 rounded border p-3">
                {renderLineRow(line)}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={line.status !== 'fulfilled'}
                    onClick={() =>
                      setReturnFormFor(returnFormFor === line.id ? null : line.id)
                    }
                  >
                    Request return
                  </Button>
                </div>

                {returnFormFor === line.id && (
                  <form
                    className="flex flex-col gap-2 rounded bg-gray-50 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      requestReturnMutation.mutate(line.id);
                    }}
                  >
                    <label className="flex flex-col gap-1 text-sm">
                      Reason
                      <Input
                        type="text"
                        required
                        maxLength={1000}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="e.g. Item arrived damaged"
                      />
                    </label>
                    <Button
                      type="submit"
                      disabled={requestReturnMutation.isPending}
                    >
                      {requestReturnMutation.isPending
                        ? 'Submitting…'
                        : 'Submit return request'}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {requestReturnMutation.isError && (
        <p className="text-sm text-red-600" role="alert">
          {requestReturnMutation.error instanceof ApiError
            ? requestReturnMutation.error.message
            : 'Return request failed.'}
        </p>
      )}

      {requestReturnMutation.isSuccess && (
        <p className="text-sm text-green-700" role="status">
          Return requested — status: {requestReturnMutation.data.status}.
        </p>
      )}
    </main>
  );
}

function renderLineRow(line: OrderLineResponse) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col text-sm">
        <span className="font-medium">Qty {line.quantity}</span>
        <span className="text-gray-600">
          Variant {line.productVariantId.slice(0, 8)}… ·{' '}
          {(Number(line.unitPriceMinor) / 100).toFixed(2)} per unit
        </span>
      </div>
      <span className="text-sm capitalize">{line.status}</span>
    </div>
  );
}
