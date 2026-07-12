import { Return } from '../../../domain/entities/return.entity';
import type { ReturnRepository } from '../../../domain/repositories/return.repository';

export class InMemoryReturnRepository implements ReturnRepository {
  private readonly store = new Map<string, Return>();

  findById(id: string): Promise<Return | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  findByOrderLineId(orderLineId: string): Promise<Return | null> {
    const found = [...this.store.values()].find(
      (r) => r.orderLineId === orderLineId,
    );
    return Promise.resolve(found ?? null);
  }

  save(returnEntity: Return): Promise<void> {
    this.store.set(returnEntity.id, returnEntity);
    return Promise.resolve();
  }

  get all(): Return[] {
    return [...this.store.values()];
  }
}
