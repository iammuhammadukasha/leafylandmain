'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { authApi } from '@/lib/api-client';
import { ApiError } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Storefront verify-email page — calls the real backend contract
 * (POST /api/v1/auth/verify-email, API Spec Volume 07 §2, FR-ID-001).
 *
 * There is no real email provider wired up yet (ConsoleEmailSender logs
 * the verification link to the backend console instead of sending it —
 * see server/src/modules/identity/infrastructure/email). So this page
 * accepts the token two ways: pre-filled from a `?token=` query param
 * (if you paste the full logged link into the browser) or typed/pasted
 * manually (if you just copy the token value from the console log).
 */
function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') ?? '');

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyEmail,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Verify email</h1>

      {verifyMutation.isSuccess ? (
        <p className="text-sm" role="status">
          {verifyMutation.data.message}{' '}
          <Link href="/login" className="underline">
            Log in
          </Link>{' '}
          to continue.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            verifyMutation.mutate({ token });
          }}
        >
          <p className="text-sm text-muted-foreground">
            Paste the verification token from your registration confirmation
            (during local development, the backend logs it to its console
            instead of sending a real email).
          </p>

          <label className="flex flex-col gap-1 text-sm">
            Token
            <Input
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>

          <Button type="submit" disabled={verifyMutation.isPending}>
            {verifyMutation.isPending ? 'Verifying…' : 'Verify email'}
          </Button>

          {verifyMutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {verifyMutation.error instanceof ApiError
                ? verifyMutation.error.message
                : 'Something went wrong. Please try again.'}
            </p>
          )}
        </form>
      )}
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
