import { Shipment } from '../../../domain/entities/shipment.entity';
import type { ShipmentRepository } from '../../../domain/repositories/shipment.repository';

export class InMemoryShipmentRepository implements ShipmentRepository {
  private readonly store = new Map<string, Shipment>();

  findById(id: string): Promise<Shipment | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  findByOrderIdAndVendorId(
    orderId: string,
    vendorId: string,
  ): Promise<Shipment | null> {
    const found = [...this.store.values()].find(
      (s) => s.orderId === orderId && s.vendorId === vendorId,
    );
    return Promise.resolve(found ?? null);
  }

  save(shipment: Shipment): Promise<void> {
    this.store.set(shipment.id, shipment);
    return Promise.resolve();
  }

  get all(): Shipment[] {
    return [...this.store.values()];
  }
}
