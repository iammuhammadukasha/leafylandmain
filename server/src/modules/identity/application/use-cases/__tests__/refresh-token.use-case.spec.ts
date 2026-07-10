import { randomUUID } from 'node:crypto';
import { RefreshTokenUseCase } from '../refresh-token.use-case';
import { User } from '../../../domain/entities/user.entity';
import { Session } from '../../../domain/entities/session.entity';
import { InMemoryUserRepository } from '../../__tests__/fakes/in-memory-user.repository';
import { InMemorySessionRepository } from '../../__tests__/fakes/in-memory-session.repository';
import {
  FakeAccessTokenService,
  FakeAuditLogger,
  FakeRefreshTokenService,
} from '../../__tests__/fakes/fake-ports';
import {
  InvalidRefreshTokenError,
  SessionRevokedError,
} from '../../../domain/errors/identity.errors';

function buildUseCase() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const accessTokens = new FakeAccessTokenService();
  const refreshTokens = new FakeRefreshTokenService();
  const auditLogger = new FakeAuditLogger();

  const useCase = new RefreshTokenUseCase(
    users,
    sessions,
    accessTokens,
    refreshTokens,
    auditLogger,
  );

  return { useCase, users, sessions, refreshTokens, auditLogger };
}

async function seedUserWithSession(
  users: InMemoryUserRepository,
  sessions: InMemorySessionRepository,
  refreshTokens: FakeRefreshTokenService,
) {
  const user = User.register({
    id: randomUUID(),
    email: 'shopper@example.com',
    passwordHash: 'irrelevant-for-this-suite',
    now: new Date(),
  });
  await users.save(user);

  const rawRefreshToken = refreshTokens.generate();
  const session = Session.startNewFamily({
    id: randomUUID(),
    userId: user.id,
    refreshTokenHash: refreshTokens.hash(rawRefreshToken),
    familyId: randomUUID(),
    deviceLabel: null,
    ipAddress: null,
    userAgent: null,
    now: new Date(),
  });
  await sessions.save(session);

  return { user, session, rawRefreshToken };
}

describe('RefreshTokenUseCase — session-family revocation (FR-ID-005, BR-ID-02)', () => {
  it('rotates the token: old session is revoked, a new session in the same family is created', async () => {
    const { useCase, users, sessions, refreshTokens } = buildUseCase();
    const { session, rawRefreshToken } = await seedUserWithSession(
      users,
      sessions,
      refreshTokens,
    );

    const result = await useCase.execute({
      refreshToken: rawRefreshToken,
      ipAddress: null,
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(rawRefreshToken);

    const originalReloaded = await sessions.findById(session.id);
    expect(originalReloaded!.isRevoked).toBe(true);

    const allSessions = sessions.all;
    expect(allSessions).toHaveLength(2);
    const newSession = allSessions.find((s) => s.id !== session.id)!;
    expect(newSession.familyId).toBe(session.familyId);
    expect(newSession.isRevoked).toBe(false);
  });

  it('rejects an unknown refresh token', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ refreshToken: 'never-issued', ipAddress: null }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('theft detection: reusing an already-rotated-out token revokes the WHOLE family, not just that token', async () => {
    const { useCase, users, sessions, refreshTokens } = buildUseCase();
    const { session, rawRefreshToken } = await seedUserWithSession(
      users,
      sessions,
      refreshTokens,
    );

    // Legitimate first rotation.
    const firstRotation = await useCase.execute({
      refreshToken: rawRefreshToken,
      ipAddress: null,
    });
    expect(sessions.all.filter((s) => !s.isRevoked)).toHaveLength(1);

    // Attacker (or a stale client) replays the ORIGINAL, now-revoked
    // token. This must revoke the entire family, including the
    // legitimately-rotated session from the step above.
    await expect(
      useCase.execute({ refreshToken: rawRefreshToken, ipAddress: null }),
    ).rejects.toBeInstanceOf(SessionRevokedError);

    const allSessions = sessions.all;
    expect(allSessions.every((s) => s.familyId === session.familyId)).toBe(
      true,
    );
    expect(allSessions.every((s) => s.isRevoked)).toBe(true);

    // The legitimately-rotated refresh token from firstRotation must also
    // now be unusable — the whole family is dead, not just the reused one.
    await expect(
      useCase.execute({
        refreshToken: firstRotation.refreshToken,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(SessionRevokedError);
  });

  it('logs a session_revoked audit event when reuse is detected', async () => {
    const { useCase, users, sessions, refreshTokens, auditLogger } =
      buildUseCase();
    const { rawRefreshToken } = await seedUserWithSession(
      users,
      sessions,
      refreshTokens,
    );

    await useCase.execute({ refreshToken: rawRefreshToken, ipAddress: null });
    await expect(
      useCase.execute({ refreshToken: rawRefreshToken, ipAddress: '1.2.3.4' }),
    ).rejects.toBeInstanceOf(SessionRevokedError);

    const revokedEvent = auditLogger.events.find(
      (e) => e.action === 'user.session_revoked',
    );
    expect(revokedEvent).toBeDefined();
    expect(revokedEvent!.diff).toEqual({
      reason: 'refresh_token_reuse_detected',
    });
  });
});
