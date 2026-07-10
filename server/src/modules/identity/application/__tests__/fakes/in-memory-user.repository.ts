import type { User } from '../../../domain/entities/user.entity';
import type { UserRepository } from '../../../domain/repositories/user.repository';

export class InMemoryUserRepository implements UserRepository {
  private readonly usersById = new Map<string, User>();

  findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (const user of this.usersById.values()) {
      if (user.email === normalized) return Promise.resolve(user);
    }
    return Promise.resolve(null);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  save(user: User): Promise<void> {
    this.usersById.set(user.id, user);
    return Promise.resolve();
  }

  get all(): User[] {
    return [...this.usersById.values()];
  }
}
