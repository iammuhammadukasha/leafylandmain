import { Order } from '../../../domain/entities/order.entity';
import type { OrderRepository } from '../../../domain/repositories/order.repository';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, Order>();

  findById(id: string): Promise<Order | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  findByRazorpayOrderId(razorpayOrderId: string): Promise<Order | null> {
    const found = [...this.store.values()].find(
      (order) => order.snapshot.razorpayOrderId === razorpayOrderId,
    );
    return Promise.resolve(found ?? null);
  }

  findByOrderLineId(orderLineId: string): Promise<Order | null> {
    const found = [...this.store.values()].find((order) =>
      order.lines.some((line) => line.id === orderLineId),
    );
    return Promise.resolve(found ?? null);
  }

  save(order: Order): Promise<void> {
    this.store.set(order.id, order);
    return Promise.resolve();
  }

  get all(): Order[] {
    return [...this.store.values()];
  }
}
