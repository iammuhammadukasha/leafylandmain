import type { Cart } from '../entities/cart.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface CartRepository {
  findById(id: string): Promise<Cart | null>;
  /** FR-ORD-001 — one active cart per user for this slice (guest cart /
   * cart merge deferred, see module header). */
  findActiveByUserId(userId: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
}

export const CART_REPOSITORY = Symbol('CART_REPOSITORY');
