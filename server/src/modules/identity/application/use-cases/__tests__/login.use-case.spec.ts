import { randomUUID } from 'node:crypto';
import { LoginUseCase } from '../login.use-case';
import { User } from '../../../domain/entities/user.entity';
import { InMemoryUserRepository } from '../../__tests__/fakes/in-memory-user.repository';
import { InMemorySessionRepository } from '../../__tests__/fakes/in-memory-session.repository';
import {
  FakeAccessTokenService,
  FakeAuditLogger,
  FakePasswordHasher,
  FakeRefreshTokenService,
} from '../../__tests__/fakes/fake-ports';
import { InvalidCredentialsError } from '../../../domain/errors/identity.errors';

async function seedUser(
  users: InMemoryUserRepository,
  hasher: FakePasswordHasher,
  overrides: { email?: string; password?: string } = {},
): Promise<User> {
  const email = overrides.email ?? 'shopper@example.com';
  const password = overrides.password ?? 'correct-horse-battery-staple';
  const user = User.register({
    id: randomUUID(),
    email,
    passwordHash: await hasher.hash(password),
    now: new Date(),
  });
  await users.save(user);
  return user;
}

function buildUseCase() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const passwordHasher = new FakePasswordHasher();
  const accessTokens = new FakeAccessTokenService();
  const refreshTokens = new FakeRefreshTokenService();
  const auditLogger = new FakeAuditLogger();

  const useCase = new LoginUseCase(
    users,
    sessions,
    passwordHasher,
    accessTokens,
    refreshTokens,
    auditLogger,
  );

  return {
    useCase,
    users,
    sessions,
    passwordHasher,
    accessTokens,
    auditLogger,
  };
}

describe('LoginUseCase', () => {
  it('returns an access + refresh token pair on valid credentials', async () => {
    const { useCase, users, passwordHasher } = buildUseCase();
    await seedUser(users, passwordHasher);

    const result = await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      deviceLabel: null,
      ipAddress: '127.0.0.1',
      userAgent: null,
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('verifies the password via the hasher port (password hashing verified)', async () => {
    const { useCase, users, passwordHasher } = buildUseCase();
    await seedUser(users, passwordHasher, { password: 'a-correct-password!' });

    await expect(
      useCase.execute({
        email: 'shopper@example.com',
        password: 'a-correct-password!',
        deviceLabel: null,
        ipAddress: null,
        userAgent: null,
      }),
    ).resolves.toBeDefined();

    await expect(
      useCase.execute({
        email: 'shopper@example.com',
        password: 'a-WRONG-password!',
        deviceLabel: null,
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('starts a new session with a fresh family id on login', async () => {
    const { useCase, users, passwordHasher, sessions } = buildUseCase();
    await seedUser(users, passwordHasher);

    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      deviceLabel: null,
      ipAddress: null,
      userAgent: null,
    });

    expect(sessions.all).toHaveLength(1);
    expect(sessions.all[0].isRevoked).toBe(false);
  });

  it('throws InvalidCredentialsError for a nonexistent email without revealing that', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        email: 'nobody@example.com',
        password: 'whatever-password',
        deviceLabel: null,
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('logs a login_failed audit event on bad credentials and login_succeeded on success', async () => {
    const { useCase, users, passwordHasher, auditLogger } = buildUseCase();
    await seedUser(users, passwordHasher);

    await expect(
      useCase.execute({
        email: 'shopper@example.com',
        password: 'wrong-password-entirely',
        deviceLabel: null,
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toThrow();

    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      deviceLabel: null,
      ipAddress: null,
      userAgent: null,
    });

    const actions = auditLogger.events.map((e) => e.action);
    expect(actions).toContain('user.login_failed');
    expect(actions).toContain('user.login_succeeded');
  });
});
