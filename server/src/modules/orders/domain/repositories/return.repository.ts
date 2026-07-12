import type { Return } from '../entities/return.entity';

/**
 * Domain-owned repository interface (port) for `returns` (FR-ORD-005).
 * Infrastructure layer provides the Prisma-backed implementation
 * (Architecture Volume 03 §4). No Prisma types appear here. Mirrors
 * ShipmentRepository's shape.
 */
export interface ReturnRepository {
  findById(id: string): Promise<Return | null>;
  /** The lookup RequestReturnUseCase's "one return per order line" check
   * (Return.orderLineId is DB-unique, same precedent as Review.orderLineId)
   * depends on. */
  findByOrderLineId(orderLineId: string): Promise<Return | null>;
  save(returnEntity: Return): Promise<void>;
}

export const RETURN_REPOSITORY = Symbol('RETURN_REPOSITORY');
