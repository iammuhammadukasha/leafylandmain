'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Storefront login page — calls the real backend contract
 * (POST /api/v1/auth/login, API Spec Volume 07 §2) to prove the frontend
 * can talk to the backend end-to-end. Deliberately minimal styling: this
 * is scaffolding, not final product design (task scope).
 */
export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((state) => state.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setTokens(data);
      router.push('/account');
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Log in</h1>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          loginMutation.mutate({ email, password });
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <Button type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Logging in…' : 'Log in'}
        </Button>

        {loginMutation.isError && (
          <p className="text-sm text-red-600" role="alert">
            {loginMutation.error instanceof ApiError
              ? loginMutation.error.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}
      </form>

      <p className="text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
