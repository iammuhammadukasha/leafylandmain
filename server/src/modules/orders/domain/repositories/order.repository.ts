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
  /** FR-ORD-006 — resolves an order line id back to its containing Order
   * aggregate (with all sibling lines loaded), so Ship/Deliver use cases
   * can check ownership/status and call Order's line-status-transition
   * methods without a separate OrderLine repository (OrderLine has no
   * existence independent of its Order — same "aggregate owns its lines"
   * modeling as the rest of this entity, see its class doc comment). */
  findByOrderLineId(orderLineId: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
