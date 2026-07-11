'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';

/**
 * Checkout confirmation page (Orders module, FR-ORD-002). Minimal by
 * design (task scope: "a simple 'your order was placed' confirmation
 * after calling checkout is sufficient"): no address-selection UI exists
 * because there is no address CRUD surface anywhere in this codebase yet
 * (FR-USR-002 is not built — see
 * server/src/modules/orders/domain/repositories/address-lookup.repository.ts's
 * doc comment for the same gap noted on the backend). The caller pastes a
 * shipping/billing address id (same id for both by default) — a real
 * checkout flow would replace this with an address picker once
 * FR-USR-002 exists.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [addressId, setAddressId] = useState('');

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  const checkout = useMutation({
    mutationFn: () =>
      ordersApi.checkout(accessToken as string, {
        shippingAddressId: addressId,
        billingAddressId: addressId,
      }),
  });

  if (!hasHydrated || !accessToken) {
    return null;
  }

  if (checkout.isSuccess) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Order placed</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">Order ID</dt>
          <dd className="font-mono text-xs">{checkout.data.orderId}</dd>
          <dt className="font-medium">Status</dt>
          <dd>pending_payment</dd>
          <dt className="font-medium">Amount</dt>
          <dd>₹{(Number(checkout.data.amountMinor) / 100).toFixed(2)}</dd>
          <dt className="font-medium">Gateway order</dt>
          <dd className="font-mono text-xs">{checkout.data.gatewayOrderId}</dd>
        </dl>
        <p className="text-sm text-gray-600">
          Payment confirmation happens via a Razorpay webhook (BR-ORD-01) —
          this order stays <code>pending_payment</code> until that webhook
          is received and its signature verified.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          checkout.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Shipping / billing address ID
          <input
            required
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder="address uuid"
          />
        </label>

        <button
          type="submit"
          disabled={checkout.isPending}
          className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {checkout.isPending ? 'Placing order…' : 'Place order'}
        </button>

        {checkout.isError && (
          <p className="text-sm text-red-600" role="alert">
            {checkout.error instanceof ApiError
              ? checkout.error.message
              : 'Checkout failed.'}
          </p>
        )}
      </form>
    </main>
  );
}
