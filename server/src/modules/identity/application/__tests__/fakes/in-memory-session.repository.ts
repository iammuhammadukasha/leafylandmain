import type { Session } from '../../../domain/entities/session.entity';
import type { SessionRepository } from '../../../domain/repositories/session.repository';

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessionsById = new Map<string, Session>();

  save(session: Session): Promise<void> {
    this.sessionsById.set(session.id, session);
    return Promise.resolve();
  }

  findById(id: string): Promise<Session | null> {
    return Promise.resolve(this.sessionsById.get(id) ?? null);
  }

  findByRefreshTokenHash(hash: string): Promise<Session | null> {
    for (const session of this.sessionsById.values()) {
      if (session.refreshTokenHash === hash) return Promise.resolve(session);
    }
    return Promise.resolve(null);
  }

  revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const session of this.sessionsById.values()) {
      if (session.familyId === familyId && !session.isRevoked) {
        session.revoke(now);
      }
    }
    return Promise.resolve();
  }

  get all(): Session[] {
    return [...this.sessionsById.values()];
  }
}
