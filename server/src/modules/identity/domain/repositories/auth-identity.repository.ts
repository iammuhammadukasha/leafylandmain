import type { AuthIdentity } from '../entities/auth-identity.entity';

export interface AuthIdentityRepository {
  save(identity: AuthIdentity): Promise<void>;
  findByUserIdAndProvider(
    userId: string,
    provider: string,
  ): Promise<AuthIdentity | null>;
}

export const AUTH_IDENTITY_REPOSITORY = Symbol('AUTH_IDENTITY_REPOSITORY');
