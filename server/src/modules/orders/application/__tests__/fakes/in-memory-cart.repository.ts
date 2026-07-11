import { Cart } from '../../../domain/entities/cart.entity';
import type { CartRepository } from '../../../domain/repositories/cart.repository';

export class InMemoryCartRepository implements CartRepository {
  private readonly store = new Map<string, Cart>();

  findById(id: string): Promise<Cart | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  findActiveByUserId(userId: string): Promise<Cart | null> {
    const found = [...this.store.values()].find(
      (cart) => cart.userId === userId && cart.status === 'active',
    );
    return Promise.resolve(found ?? null);
  }

  save(cart: Cart): Promise<void> {
    this.store.set(cart.id, cart);
    return Promise.resolve();
  }

  get all(): Cart[] {
    return [...this.store.values()];
  }
}
