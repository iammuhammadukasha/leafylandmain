'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';
import { useEffect } from 'react';

/**
 * Storefront account page — calls the real backend contract
 * (GET /api/v1/users/me/profile, API Spec Volume 07 §3, FR-USR-001) with
 * the JWT obtained at login, proving the protected-endpoint path works
 * end-to-end from the frontend.
 */
export default function AccountPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
    }
  }, [accessToken, router]);

  const profileQuery = useQuery({
    queryKey: ['profile', accessToken],
    queryFn: () => userApi.getProfile(accessToken as string),
    enabled: Boolean(accessToken),
  });

  if (!accessToken) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Account</h1>

      {profileQuery.isLoading && <p>Loading profile…</p>}

      {profileQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {profileQuery.error instanceof ApiError
            ? profileQuery.error.message
            : 'Failed to load profile.'}
        </p>
      )}

      {profileQuery.data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">User ID</dt>
          <dd>{profileQuery.data.userId}</dd>

          <dt className="font-medium">Email</dt>
          <dd>{profileQuery.data.email}</dd>

          <dt className="font-medium">Full name</dt>
          <dd>{profileQuery.data.fullName ?? '—'}</dd>

          <dt className="font-medium">Email verified</dt>
          <dd>{profileQuery.data.emailVerifiedAt ? 'Yes' : 'No'}</dd>
        </dl>
      )}
    </main>
  );
}
