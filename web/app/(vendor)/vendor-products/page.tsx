'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, vendorProductApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Vendor product management — lists the caller's own products
 * (GET /api/v1/vendors/me/products, FR-VND-005) with a create form
 * (business fields + organic claim checkbox + document id field, BR-PRD-01)
 * and publish/delist buttons. Follows the same conventions as
 * vendor-register/dashboard: TanStack Query, ApiError handling, and the
 * hasHydrated pattern from auth-store (a previous bug in this exact
 * pattern — pages redirecting to /login on fresh navigation despite a
 * valid stored token — was just fixed; not reintroduced here).
 *
 * Route is `/vendor-products`, not `/products`, because the Next.js App
 * Router route groups `(storefront)` and `(vendor)` both flatten out of
 * the URL — a `(vendor)/products` page would collide with the public
 * `(storefront)/products` page at the same `/products` path (Turbopack
 * build fails on "two parallel pages that resolve to the same path").
 */
export default function VendorProductsPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isOrganicClaim, setIsOrganicClaim] = useState(false);
  const [organicCertDocumentId, setOrganicCertDocumentId] = useState('');

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  const productsQuery = useQuery({
    queryKey: ['my-products', accessToken],
    queryFn: () => vendorProductApi.listMyProducts(accessToken as string),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => catalogApi.listCategories(),
    enabled: Boolean(accessToken),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) throw new Error('Not authenticated.');
      return vendorProductApi.createProduct(accessToken, {
        categoryId,
        title,
        description: description || undefined,
        isOrganicClaim,
        organicCertDocumentId: isOrganicClaim
          ? organicCertDocumentId || undefined
          : undefined,
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setIsOrganicClaim(false);
      setOrganicCertDocumentId('');
      void queryClient.invalidateQueries({ queryKey: ['my-products'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (productId: string) => {
      if (!accessToken) throw new Error('Not authenticated.');
      return vendorProductApi.publishProduct(accessToken, productId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-products'] });
    },
  });

  const delistMutation = useMutation({
    mutationFn: (productId: string) => {
      if (!accessToken) throw new Error('Not authenticated.');
      return vendorProductApi.delistProduct(accessToken, productId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-products'] });
    },
  });

  if (!hasHydrated || !accessToken) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">My Products</h1>

      <form
        className="flex flex-col gap-3 rounded border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
      >
        <h2 className="text-lg font-medium">Create a product</h2>

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            required
            className="rounded border px-2 py-1"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="" disabled>
              Select a category
            </option>
            {categoriesQuery.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Title
          <Input
            type="text"
            required
            minLength={2}
            maxLength={300}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <Input
            type="text"
            maxLength={5000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOrganicClaim}
            onChange={(event) => setIsOrganicClaim(event.target.checked)}
          />
          This product has an organic claim
        </label>

        {isOrganicClaim && (
          <label className="flex flex-col gap-1 text-sm">
            Approved organic certificate document ID
            <Input
              type="text"
              placeholder="Document UUID (must be approved organic_certificate)"
              value={organicCertDocumentId}
              onChange={(event) =>
                setOrganicCertDocumentId(event.target.value)
              }
            />
          </label>
        )}

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating…' : 'Create draft product'}
        </Button>

        {createMutation.isError && (
          <p className="text-sm text-red-600" role="alert">
            {createMutation.error instanceof ApiError
              ? `${createMutation.error.code}: ${createMutation.error.message}`
              : 'Something went wrong. Please try again.'}
          </p>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Your products</h2>

        {productsQuery.isLoading && <p>Loading products…</p>}

        {productsQuery.isError && (
          <p className="text-sm text-red-600" role="alert">
            {productsQuery.error instanceof ApiError
              ? productsQuery.error.message
              : 'Failed to load products.'}
          </p>
        )}

        {productsQuery.data && productsQuery.data.length === 0 && (
          <p className="text-sm text-gray-600">No products yet.</p>
        )}

        {productsQuery.data && productsQuery.data.length > 0 && (
          <ul className="flex flex-col gap-3">
            {productsQuery.data.map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-2 rounded border p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{product.title}</span>
                  <span className="text-sm capitalize text-gray-600">
                    {product.status}
                    {product.isOrganicClaim && ' · Organic'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={
                      product.status !== 'draft' || publishMutation.isPending
                    }
                    onClick={() => publishMutation.mutate(product.id)}
                  >
                    Publish
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      product.status !== 'active' || delistMutation.isPending
                    }
                    onClick={() => delistMutation.mutate(product.id)}
                  >
                    Delist
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(publishMutation.isError || delistMutation.isError) && (
          <p className="text-sm text-red-600" role="alert">
            {(publishMutation.error ?? delistMutation.error) instanceof
            ApiError
              ? ((publishMutation.error ?? delistMutation.error) as ApiError)
                  .message
              : 'Action failed.'}
          </p>
        )}
      </section>
    </main>
  );
}
