'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, ordersApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Public product detail — calls GET /api/v1/catalog/products/:id and
 * GET /api/v1/catalog/products/:id/variants (API Spec Volume 07 §5.2,
 * FR-PRD-002). Draft/delisted products 404 for a non-owner caller, which
 * this page surfaces as a plain "not found" message (no special-casing —
 * the backend already enforces the rule, per Volume 04 §5 note).
 *
 * "Add to cart" (Orders module, FR-ORD-001) is Auth-only for this slice —
 * an unauthenticated visitor sees a "log in to add to cart" prompt instead
 * of a disabled button, matching the "Auth-only cart, guest cart deferred"
 * scope reduction documented in server/prisma/schema.prisma's Orders
 * context header comment.
 */
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);

  const [reviewOrderLineId, setReviewOrderLineId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');

  const [questionBody, setQuestionBody] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const productQuery = useQuery({
    queryKey: ['catalog-product', productId],
    queryFn: () => catalogApi.getProduct(productId),
    retry: false,
  });

  const variantsQuery = useQuery({
    queryKey: ['catalog-product-variants', productId],
    queryFn: () => catalogApi.getProductVariants(productId),
    enabled: productQuery.isSuccess,
    retry: false,
  });

  const reviewsQuery = useQuery({
    queryKey: ['catalog-product-reviews', productId],
    queryFn: () => catalogApi.listReviews(productId),
    enabled: productQuery.isSuccess,
  });

  const questionsQuery = useQuery({
    queryKey: ['catalog-product-questions', productId],
    queryFn: () => catalogApi.listQuestions(productId),
    enabled: productQuery.isSuccess,
  });

  const addToCart = useMutation({
    mutationFn: (variantId: string) =>
      ordersApi.addCartLine(accessToken as string, {
        productVariantId: variantId,
        quantity: 1,
      }),
    onSuccess: (_cart, variantId) => {
      setAddedVariantId(variantId);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const submitReview = useMutation({
    mutationFn: () =>
      catalogApi.submitReview(accessToken as string, productId, {
        orderLineId: reviewOrderLineId,
        rating: reviewRating,
        body: reviewBody,
      }),
    onSuccess: () => {
      setReviewOrderLineId('');
      setReviewBody('');
      void queryClient.invalidateQueries({
        queryKey: ['catalog-product-reviews', productId],
      });
    },
  });

  const askQuestion = useMutation({
    mutationFn: () =>
      catalogApi.askQuestion(accessToken as string, productId, {
        body: questionBody,
      }),
    onSuccess: () => {
      setQuestionBody('');
      void queryClient.invalidateQueries({
        queryKey: ['catalog-product-questions', productId],
      });
    },
  });

  const answerQuestion = useMutation({
    mutationFn: (questionId: string) =>
      catalogApi.answerQuestion(accessToken as string, questionId, {
        body: answerDrafts[questionId] ?? '',
      }),
    onSuccess: (_answer, questionId) => {
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
      void queryClient.invalidateQueries({
        queryKey: ['catalog-product-questions', productId],
      });
    },
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
      {productQuery.isLoading && <p>Loading product…</p>}

      {productQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {productQuery.error instanceof ApiError &&
          productQuery.error.code === 'NOT_FOUND'
            ? 'This product is not available.'
            : 'Failed to load product.'}
        </p>
      )}

      {productQuery.data && (
        <>
          <h1 className="text-2xl font-semibold">{productQuery.data.title}</h1>
          <p className="text-sm text-gray-600">
            {productQuery.data.description ?? 'No description.'}
          </p>
          {productQuery.data.isOrganicClaim && (
            <span className="w-fit rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
              Organic certified
            </span>
          )}

          <h2 className="mt-4 text-lg font-medium">Variants</h2>
          {variantsQuery.isLoading && <p>Loading variants…</p>}
          {variantsQuery.data && variantsQuery.data.length === 0 && (
            <p className="text-sm text-gray-600">No variants listed.</p>
          )}
          {variantsQuery.data && variantsQuery.data.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1">SKU</th>
                  <th className="py-1">Price</th>
                  <th className="py-1">Stock</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {variantsQuery.data.map((variant) => (
                  <tr key={variant.id} className="border-b">
                    <td className="py-1">{variant.sku}</td>
                    <td className="py-1">
                      &#8377;{(Number(variant.priceMinor) / 100).toFixed(2)}
                    </td>
                    <td className="py-1">{variant.stockQuantity}</td>
                    <td className="py-1 text-right">
                      {!hasHydrated ? null : accessToken ? (
                        <button
                          type="button"
                          disabled={
                            addToCart.isPending || variant.stockQuantity === 0
                          }
                          onClick={() => addToCart.mutate(variant.id)}
                          className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {addedVariantId === variant.id
                            ? 'Added'
                            : 'Add to cart'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => router.push('/login')}
                          className="text-xs underline"
                        >
                          Log in to add to cart
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {addToCart.isError && (
            <p className="text-sm text-red-600" role="alert">
              {addToCart.error instanceof ApiError
                ? addToCart.error.message
                : 'Failed to add to cart.'}
            </p>
          )}

          {accessToken && (
            <a href="/cart" className="mt-2 w-fit text-sm underline">
              View cart
            </a>
          )}

          <h2 className="mt-6 text-lg font-medium">Reviews</h2>
          {reviewsQuery.data && reviewsQuery.data.data.length === 0 && (
            <p className="text-sm text-gray-600">No reviews yet.</p>
          )}
          {reviewsQuery.data && reviewsQuery.data.data.length > 0 && (
            <ul className="flex flex-col gap-2">
              {reviewsQuery.data.data.map((review) => (
                <li key={review.id} className="border-b pb-2 text-sm">
                  <span className="font-medium">{review.rating}/5</span> —{' '}
                  {review.body}
                </li>
              ))}
            </ul>
          )}

          {!hasHydrated ? null : accessToken ? (
            <form
              className="mt-2 flex flex-col gap-2 rounded border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitReview.mutate();
              }}
            >
              <p className="text-xs text-gray-600">
                Leave a review using a paid order line for this product
                (order id shown on the{' '}
                <a href="/cart" className="underline">
                  order confirmation
                </a>{' '}
                after checkout).
              </p>
              <label className="flex flex-col gap-1 text-sm">
                Order line id
                <Input
                  type="text"
                  required
                  value={reviewOrderLineId}
                  onChange={(event) =>
                    setReviewOrderLineId(event.target.value)
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Rating (1-5)
                <Input
                  type="number"
                  min={1}
                  max={5}
                  required
                  value={reviewRating}
                  onChange={(event) =>
                    setReviewRating(Number(event.target.value))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Review
                <Input
                  type="text"
                  required
                  value={reviewBody}
                  onChange={(event) => setReviewBody(event.target.value)}
                />
              </label>
              <Button type="submit" disabled={submitReview.isPending}>
                {submitReview.isPending ? 'Submitting…' : 'Submit review'}
              </Button>
              {submitReview.isError && (
                <p className="text-sm text-red-600" role="alert">
                  {submitReview.error instanceof ApiError
                    ? submitReview.error.message
                    : 'Failed to submit review.'}
                </p>
              )}
            </form>
          ) : (
            <p className="text-sm">
              <a href="/login" className="underline">
                Log in
              </a>{' '}
              to leave a review.
            </p>
          )}

          <h2 className="mt-6 text-lg font-medium">Questions &amp; answers</h2>
          {questionsQuery.data && questionsQuery.data.data.length === 0 && (
            <p className="text-sm text-gray-600">No questions yet.</p>
          )}
          {questionsQuery.data && questionsQuery.data.data.length > 0 && (
            <ul className="flex flex-col gap-3">
              {questionsQuery.data.data.map((question) => (
                <li key={question.id} className="border-b pb-2 text-sm">
                  <p className="font-medium">Q: {question.body}</p>
                  {question.answers.map((answer) => (
                    <p key={answer.id} className="ml-3 text-gray-700">
                      A: {answer.body}
                    </p>
                  ))}
                  {hasHydrated && accessToken && question.answers.length === 0 && (
                    <form
                      className="ml-3 mt-1 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        answerQuestion.mutate(question.id);
                      }}
                    >
                      <Input
                        type="text"
                        placeholder="Answer as the owning vendor…"
                        value={answerDrafts[question.id] ?? ''}
                        onChange={(event) =>
                          setAnswerDrafts((prev) => ({
                            ...prev,
                            [question.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        type="submit"
                        disabled={answerQuestion.isPending}
                      >
                        Answer
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {answerQuestion.isError && (
            <p className="text-sm text-red-600" role="alert">
              {answerQuestion.error instanceof ApiError
                ? answerQuestion.error.message
                : 'Failed to submit answer.'}
            </p>
          )}

          {!hasHydrated ? null : accessToken ? (
            <form
              className="mt-2 flex flex-col gap-2 rounded border p-3"
              onSubmit={(event) => {
                event.preventDefault();
                askQuestion.mutate();
              }}
            >
              <label className="flex flex-col gap-1 text-sm">
                Ask a question
                <Input
                  type="text"
                  required
                  value={questionBody}
                  onChange={(event) => setQuestionBody(event.target.value)}
                />
              </label>
              <Button type="submit" disabled={askQuestion.isPending}>
                {askQuestion.isPending ? 'Posting…' : 'Post question'}
              </Button>
              {askQuestion.isError && (
                <p className="text-sm text-red-600" role="alert">
                  {askQuestion.error instanceof ApiError
                    ? askQuestion.error.message
                    : 'Failed to post question.'}
                </p>
              )}
            </form>
          ) : (
            <p className="text-sm">
              <a href="/login" className="underline">
                Log in
              </a>{' '}
              to ask a question.
            </p>
          )}
        </>
      )}
    </main>
  );
}
