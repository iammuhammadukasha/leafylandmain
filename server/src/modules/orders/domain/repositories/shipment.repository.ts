import type { Shipment } from '../entities/shipment.entity';

/**
 * Domain-owned repository interface (port) for `shipments` (FR-ORD-006).
 * Infrastructure layer provides the Prisma-backed implementation
 * (Architecture Volume 03 §4). No Prisma types appear here. Mirrors
 * OrderRepository's shape.
 */
export interface ShipmentRepository {
  findById(id: string): Promise<Shipment | null>;
  /** The lookup this whole module's "one shipment per vendor per order"
   * grouping rule depends on — see Shipment entity's doc comment. */
  findByOrderIdAndVendorId(
    orderId: string,
    vendorId: string,
  ): Promise<Shipment | null>;
  save(shipment: Shipment): Promise<void>;
}

export const SHIPMENT_REPOSITORY = Symbol('SHIPMENT_REPOSITORY');
