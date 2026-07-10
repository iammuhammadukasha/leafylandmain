import type { Session } from '../entities/session.entity';

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  /** Finds the most recent (active or revoked) session row for a given
   * refresh-token hash — used to detect reuse of a rotated-out token
   * (BR-ID-02 theft detection). */
  findByRefreshTokenHash(hash: string): Promise<Session | null>;
  /** Revokes every session sharing a family id — used when a reused
   * refresh token is detected (FR-ID-005). */
  revokeFamily(familyId: string, now: Date): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
