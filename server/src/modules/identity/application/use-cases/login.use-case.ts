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
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port';
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenService,
} from '../ports/access-token.port';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from '../ports/refresh-token.port';
import { AUDIT_LOGGER, type AuditLogger } from '../ports/audit-logger.port';
import { InvalidCredentialsError } from '../../domain/errors/identity.errors';

export interface LoginInput {
  email: string;
  password: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * FR-ID-001 (login) — email/password authentication, issues an access +
 * refresh token pair and starts a new session family.
 *
 * DEFERRED: FR-ID-004 MFA branch. Per the API spec, `/login` should
 * return `{mfaRequired: true, mfaToken}` instead of tokens when the
 * account has MFA enabled, and a separate `/login/mfa` endpoint completes
 * the flow. Out of scope for this vertical slice (task instruction: skip
 * MFA branch, note as deferred). TODO(FR-ID-004): before this account
 * type reaches production, branch here on `user.mfaEnabled` and return an
 * `mfaToken` instead of finishing login, wire `/login/mfa` and
 * `/mfa/enroll|confirm|disable` per API Spec §2.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokens: AccessTokenService,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);

    if (!user || !user.passwordHash) {
      await this.auditLogger.record({
        actorUserId: null,
        action: 'user.login_failed',
        targetType: 'user',
        targetId: normalizedEmail,
        ipAddress: input.ipAddress,
      });
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.passwordHasher.verify(
      user.passwordHash,
      input.password,
    );
    if (!passwordValid) {
      await this.auditLogger.record({
        actorUserId: user.id,
        action: 'user.login_failed',
        targetType: 'user',
        targetId: user.id,
        ipAddress: input.ipAddress,
      });
      throw new InvalidCredentialsError();
    }

    // TODO(FR-ID-004): if (user.mfaEnabled) { return partial mfa-required
    // result instead of continuing below. } — deferred for this slice.

    const now = new Date();
    const rawRefreshToken = this.refreshTokens.generate();
    const session = Session.startNewFamily({
      id: randomUUID(),
      userId: user.id,
      refreshTokenHash: this.refreshTokens.hash(rawRefreshToken),
      familyId: randomUUID(),
      deviceLabel: input.deviceLabel,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      now,
    });
    await this.sessions.save(session);

    const accessToken = this.accessTokens.sign({
      sub: user.id,
      email: user.email,
      roles: [], // RBAC (FR-ID-006) role lookup not wired in this slice
    });

    await this.auditLogger.record({
      actorUserId: user.id,
      action: 'user.login_succeeded',
      targetType: 'user',
      targetId: user.id,
      ipAddress: input.ipAddress,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
