import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Session } from '../../domain/entities/session.entity';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/repositories/user.repository';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../domain/repositories/session.repository';
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenService,
} from '../ports/access-token.port';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from '../ports/refresh-token.port';
import { AUDIT_LOGGER, type AuditLogger } from '../ports/audit-logger.port';
import {
  InvalidRefreshTokenError,
  SessionRevokedError,
  UserNotFoundError,
} from '../../domain/errors/identity.errors';

export interface RefreshTokenInput {
  refreshToken: string;
  ipAddress: string | null;
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * FR-ID-005 — refresh token rotation with reuse/theft detection
 * (BR-ID-02: "session tokens are never returned in logs or error
 * messages" plus the family-revocation invariant described in FR-ID-005:
 * "a reused/revoked refresh token invalidates the whole session family").
 *
 * Rotation flow:
 * 1. Hash the presented raw refresh token, look up the session row by
 *    hash.
 * 2. If no row matches -> InvalidRefreshTokenError (never existed, or the
 *    hash simply doesn't match anything — same generic error either way).
 * 3. If the row IS revoked -> this is a reuse of an already-rotated-out
 *    token. That's the theft signal: revoke the entire family
 *    immediately, then throw SessionRevokedError. This is the one
 *    invariant this use case exists to get right.
 * 4. Otherwise: revoke the presented session row, mint a new session row
 *    in the same family with a freshly generated refresh token, and
 *    return new access+refresh tokens.
 */
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokens: AccessTokenService,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenResult> {
    const presentedHash = this.refreshTokens.hash(input.refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(presentedHash);

    if (!session) {
      throw new InvalidRefreshTokenError();
    }

    if (session.isRevoked) {
      // Reuse of a rotated-out (or already-revoked) token: revoke the
      // whole family and refuse. This is the theft-detection invariant.
      const now = new Date();
      await this.sessions.revokeFamily(session.familyId, now);
      await this.auditLogger.record({
        actorUserId: session.userId,
        action: 'user.session_revoked',
        targetType: 'session_family',
        targetId: session.familyId,
        diff: { reason: 'refresh_token_reuse_detected' },
        ipAddress: input.ipAddress,
      });
      throw new SessionRevokedError();
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const now = new Date();
    session.revoke(now);
    await this.sessions.save(session);

    const rawRefreshToken = this.refreshTokens.generate();
    const rotated = Session.rotate({
      id: randomUUID(),
      previous: session,
      refreshTokenHash: this.refreshTokens.hash(rawRefreshToken),
      now,
    });
    await this.sessions.save(rotated);

    const accessToken = this.accessTokens.sign({
      sub: user.id,
      email: user.email,
      roles: [],
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
