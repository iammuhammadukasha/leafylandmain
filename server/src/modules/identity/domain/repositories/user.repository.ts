import type { User } from '../entities/user.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
