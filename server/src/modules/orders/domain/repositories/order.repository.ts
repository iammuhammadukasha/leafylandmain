import type { Order } from '../entities/order.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  /** Webhook handler looks orders up by the gateway's order id, not the
   * platform id — that's the only identifier the webhook payload carries
   * (FR-ORD-003). */
  findByRazorpayOrderId(razorpayOrderId: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
