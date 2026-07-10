import type { AuthIdentity } from '../../../domain/entities/auth-identity.entity';
import type { AuthIdentityRepository } from '../../../domain/repositories/auth-identity.repository';

export class InMemoryAuthIdentityRepository implements AuthIdentityRepository {
  private readonly identities: AuthIdentity[] = [];

  save(identity: AuthIdentity): Promise<void> {
    this.identities.push(identity);
    return Promise.resolve();
  }

  findByUserIdAndProvider(
    userId: string,
    provider: string,
  ): Promise<AuthIdentity | null> {
    return Promise.resolve(
      this.identities.find(
        (i) => i.snapshot.userId === userId && i.provider === provider,
      ) ?? null,
    );
  }
}
