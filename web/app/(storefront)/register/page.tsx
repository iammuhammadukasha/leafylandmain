'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { authApi } from '@/lib/api-client';
import { ApiError } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Storefront register page — calls the real backend contract
 * (POST /api/v1/auth/register, API Spec Volume 07 §2, FR-ID-001).
 * The backend always returns the same generic message whether or not the
 * email was already taken (AC in FR-ID-001), so this page just surfaces
 * that message rather than assuming success means "new account created".
 */
export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const registerMutation = useMutation({
    mutationFn: authApi.register,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Create account</h1>

      {registerMutation.isSuccess ? (
        <p className="text-sm" role="status">
          {registerMutation.data.message} Once you have the verification
          link, open it or paste the token on the{' '}
          <Link href="/verify-email" className="underline">
            verify email
          </Link>{' '}
          page.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            registerMutation.mutate({ email, password });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            Email
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Password
            <Input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <Button type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>

          {registerMutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {registerMutation.error instanceof ApiError
                ? registerMutation.error.message
                : 'Something went wrong. Please try again.'}
            </p>
          )}
        </form>
      )}

      <p className="text-sm">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
