import { RegisterUserUseCase } from '../register-user.use-case';
import { InMemoryUserRepository } from '../../__tests__/fakes/in-memory-user.repository';
import { InMemoryAuthIdentityRepository } from '../../__tests__/fakes/in-memory-auth-identity.repository';
import {
  FakeAuditLogger,
  FakeEmailSender,
  FakeEmailVerificationTokenService,
  FakePasswordHasher,
} from '../../__tests__/fakes/fake-ports';

function buildUseCase() {
  const users = new InMemoryUserRepository();
  const authIdentities = new InMemoryAuthIdentityRepository();
  const passwordHasher = new FakePasswordHasher();
  const verificationTokens = new FakeEmailVerificationTokenService();
  const emailSender = new FakeEmailSender();
  const auditLogger = new FakeAuditLogger();

  const useCase = new RegisterUserUseCase(
    users,
    authIdentities,
    passwordHasher,
    verificationTokens,
    emailSender,
    auditLogger,
  );

  return {
    useCase,
    users,
    authIdentities,
    passwordHasher,
    emailSender,
    auditLogger,
  };
}

describe('RegisterUserUseCase', () => {
  it('creates a user with an argon2-adapter-hashed password (via the port) on valid registration', async () => {
    const { useCase, users } = buildUseCase();

    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: '127.0.0.1',
    });

    expect(users.all).toHaveLength(1);
    const created = users.all[0];
    expect(created.email).toBe('shopper@example.com');
    // Verified through the port contract: hash is never the plaintext,
    // and the same hasher can verify it back.
    expect(created.passwordHash).not.toBe('correct-horse-battery-staple');
    expect(
      await new FakePasswordHasher().verify(
        created.passwordHash!,
        'correct-horse-battery-staple',
      ),
    ).toBe(true);
  });

  it('creates a password AuthIdentity linked to the new user (BR-ID-01)', async () => {
    const { useCase, users, authIdentities } = buildUseCase();

    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: null,
    });

    const user = users.all[0];
    const identity = await authIdentities.findByUserIdAndProvider(
      user.id,
      'password',
    );
    expect(identity).not.toBeNull();
  });

  it('sends a verification email (stub) on successful registration', async () => {
    const { useCase, emailSender } = buildUseCase();

    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: null,
    });

    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0].to).toBe('shopper@example.com');
  });

  it('writes a user.registered audit event', async () => {
    const { useCase, auditLogger } = buildUseCase();

    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: '10.0.0.1',
    });

    expect(auditLogger.events).toHaveLength(1);
    expect(auditLogger.events[0].action).toBe('user.registered');
  });

  it('AC (FR-ID-001): duplicate email returns the same generic response and creates no second user', async () => {
    const { useCase, users } = buildUseCase();

    const first = await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: null,
    });
    const second = await useCase.execute({
      email: 'shopper@example.com',
      password: 'a-different-strong-password',
      ipAddress: null,
    });

    expect(second).toEqual(first);
    expect(users.all).toHaveLength(1);
  });

  it('AC (FR-ID-001): duplicate email registration does not send a second verification email', async () => {
    const { useCase, emailSender } = buildUseCase();

    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: null,
    });
    await useCase.execute({
      email: 'shopper@example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: null,
    });

    expect(emailSender.sent).toHaveLength(1);
  });

  it('normalizes email case so Shopper@Example.com and shopper@example.com collide', async () => {
    const { useCase, users } = buildUseCase();

    await useCase.execute({
      email: 'Shopper@Example.com',
      password: 'correct-horse-battery-staple',
      ipAddress: null,
    });
    const result = await useCase.execute({
      email: 'shopper@example.com',
      password: 'another-strong-password',
      ipAddress: null,
    });

    expect(users.all).toHaveLength(1);
    expect(result.message).toContain('check your inbox');
  });

  describe('VR: password strength', () => {
    it('rejects passwords shorter than 10 characters without creating a user', async () => {
      const { useCase, users } = buildUseCase();

      await useCase.execute({
        email: 'shopper@example.com',
        password: 'short1',
        ipAddress: null,
      });

      expect(users.all).toHaveLength(0);
    });

    it('rejects common passwords from the deny-list without creating a user', async () => {
      const { useCase, users } = buildUseCase();

      await useCase.execute({
        email: 'shopper@example.com',
        password: 'password123',
        ipAddress: null,
      });

      expect(users.all).toHaveLength(0);
    });

    it('does not leak whether rejection was due to weak password vs. duplicate email (same generic response)', async () => {
      const { useCase } = buildUseCase();

      const weakPasswordResult = await useCase.execute({
        email: 'shopper@example.com',
        password: 'weak',
        ipAddress: null,
      });

      expect(weakPasswordResult.message).toContain('check your inbox');
    });
  });
});
