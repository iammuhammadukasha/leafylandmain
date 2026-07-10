import type { PasswordHasher } from '../../ports/password-hasher.port';
import type {
  AccessTokenClaims,
  AccessTokenService,
} from '../../ports/access-token.port';
import type { RefreshTokenService } from '../../ports/refresh-token.port';
import type {
  EmailVerificationTokenPayload,
  EmailVerificationTokenService,
} from '../../ports/email-verification-token.port';
import type { EmailSender } from '../../ports/email-sender.port';
import type { AuditEvent, AuditLogger } from '../../ports/audit-logger.port';

/** Deterministic, fast fake — real hashing isn't needed to test use-case
 * orchestration, and argon2 is exercised separately (see
 * argon2-password-hasher.spec.ts) for the "hashing verified" AC. */
export class FakePasswordHasher implements PasswordHasher {
  hash(plainText: string): Promise<string> {
    return Promise.resolve(`hashed:${plainText}`);
  }

  verify(hash: string, plainText: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plainText}`);
  }
}

export class FakeAccessTokenService implements AccessTokenService {
  private readonly issued = new Map<string, AccessTokenClaims>();
  private counter = 0;

  sign(claims: AccessTokenClaims): string {
    const token = `access-token-${this.counter++}`;
    this.issued.set(token, claims);
    return token;
  }

  verify(token: string): AccessTokenClaims | null {
    return this.issued.get(token) ?? null;
  }
}

export class FakeRefreshTokenService implements RefreshTokenService {
  private counter = 0;

  generate(): string {
    return `refresh-raw-${this.counter++}`;
  }

  hash(rawToken: string): string {
    return `hashed:${rawToken}`;
  }
}

export class FakeEmailVerificationTokenService implements EmailVerificationTokenService {
  private readonly issued = new Map<string, EmailVerificationTokenPayload>();
  private counter = 0;

  generate(payload: EmailVerificationTokenPayload): string {
    const token = `verify-token-${this.counter++}`;
    this.issued.set(token, payload);
    return token;
  }

  verify(token: string): EmailVerificationTokenPayload | null {
    return this.issued.get(token) ?? null;
  }
}

export class FakeEmailSender implements EmailSender {
  public readonly sent: Array<{ to: string; token: string }> = [];

  sendVerificationEmail(params: { to: string; token: string }): Promise<void> {
    this.sent.push(params);
    return Promise.resolve();
  }
}

export class FakeAuditLogger implements AuditLogger {
  public readonly events: AuditEvent[] = [];

  record(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}
