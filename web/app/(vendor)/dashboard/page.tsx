'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { vendorApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';

/**
 * Vendor dashboard — calls the real backend contract
 * (GET /api/v1/vendors/me, API Spec Volume 07 §4) with the JWT obtained at
 * login, proving the vendor-scoped protected-endpoint path works
 * end-to-end from the frontend. Same pattern as
 * app/(storefront)/account/page.tsx.
 */
export default function VendorDashboardPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  const vendorQuery = useQuery({
    queryKey: ['my-vendor', accessToken],
    queryFn: () => vendorApi.getMyVendor(accessToken as string),
    enabled: Boolean(accessToken),
    retry: false,
  });

  if (!hasHydrated || !accessToken) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Vendor Dashboard</h1>

      <nav className="flex gap-4 text-sm underline">
        <Link href="/vendor-products">My Products</Link>
        <Link href="/vendor-orders">My Orders</Link>
      </nav>

      {vendorQuery.isLoading && <p>Loading vendor…</p>}

      {vendorQuery.isError && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-600" role="alert">
            {vendorQuery.error instanceof ApiError
              ? vendorQuery.error.message
              : 'Failed to load vendor.'}
          </p>
          {vendorQuery.error instanceof ApiError &&
            vendorQuery.error.code === 'NOT_FOUND' && (
              <p className="text-sm">
                You don&rsquo;t have a vendor account yet.{' '}
                <Link href="/vendor-register" className="underline">
                  Register as a vendor
                </Link>
                .
              </p>
            )}
        </div>
      )}

      {vendorQuery.data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">Business name</dt>
          <dd>{vendorQuery.data.businessName}</dd>

          <dt className="font-medium">Status</dt>
          <dd className="capitalize">{vendorQuery.data.status}</dd>

          <dt className="font-medium">Description</dt>
          <dd>{vendorQuery.data.description ?? '—'}</dd>

          {vendorQuery.data.status === 'rejected' &&
            vendorQuery.data.rejectedReason && (
              <>
                <dt className="font-medium">Rejection reason</dt>
                <dd>{vendorQuery.data.rejectedReason}</dd>
              </>
            )}
        </dl>
      )}
    </main>
  );
}
