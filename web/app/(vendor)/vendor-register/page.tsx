'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { vendorApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Vendor register page — calls the real backend contract
 * (POST /api/v1/vendors, API Spec Volume 07 §4, FR-VND-001) with the
 * logged-in user's JWT. On success the vendor is created in `pending`
 * status and the caller is granted vendor_owner scoped to it — the vendor
 * dashboard (app/(vendor)/dashboard) is where that status becomes visible.
 */
export default function VendorRegisterPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  const registerVendorMutation = useMutation({
    mutationFn: (payload: { businessName: string; description?: string }) => {
      if (!accessToken) {
        throw new Error('Not authenticated.');
      }
      return vendorApi.register(accessToken, payload);
    },
  });

  if (!hasHydrated || !accessToken) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Become a vendor</h1>

      {registerVendorMutation.isSuccess ? (
        <p className="text-sm" role="status">
          Your vendor application for &ldquo;
          {registerVendorMutation.data.businessName}&rdquo; was submitted and
          is now <strong>{registerVendorMutation.data.status}</strong> review
          by our team. Check your{' '}
          <a href="/dashboard" className="underline">
            vendor dashboard
          </a>{' '}
          for status updates.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            registerVendorMutation.mutate({
              businessName,
              description: description || undefined,
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            Business name
            <Input
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Description
            <Input
              type="text"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <Button type="submit" disabled={registerVendorMutation.isPending}>
            {registerVendorMutation.isPending
              ? 'Submitting…'
              : 'Submit application'}
          </Button>

          {registerVendorMutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {registerVendorMutation.error instanceof ApiError
                ? registerVendorMutation.error.message
                : 'Something went wrong. Please try again.'}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
