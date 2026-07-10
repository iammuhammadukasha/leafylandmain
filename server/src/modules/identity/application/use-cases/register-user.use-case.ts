import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { User } from '../../domain/entities/user.entity';
import { AuthIdentity } from '../../domain/entities/auth-identity.entity';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/repositories/user.repository';
import {
  AUTH_IDENTITY_REPOSITORY,
  type AuthIdentityRepository,
} from '../../domain/repositories/auth-identity.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port';
import {
  EMAIL_VERIFICATION_TOKEN_SERVICE,
  type EmailVerificationTokenService,
} from '../ports/email-verification-token.port';
import { EMAIL_SENDER, type EmailSender } from '../ports/email-sender.port';
import { AUDIT_LOGGER, type AuditLogger } from '../ports/audit-logger.port';

export interface RegisterUserInput {
  email: string;
  password: string;
  ipAddress: string | null;
}

// FR-ID-001 AC: duplicate email registration must return a generic
// "check your email" response regardless of outcome — this type has no
// "already exists" variant on purpose, so the interface layer cannot leak
// existence by branching on the result shape.
export interface RegisterUserResult {
  message: string;
}

const COMMON_PASSWORDS = new Set([
  'password123',
  '1234567890',
  'qwertyuiop',
  'password1234',
  'letmein12345',
]);

const GENERIC_RESULT: RegisterUserResult = {
  message:
    'If that email is available, we have sent a verification link. Please check your inbox.',
};

/**
 * FR-ID-001 — Email/password signup.
 * VR: password strength (min 10 chars, not in common-password list).
 * AC: duplicate email returns the same generic response (no enumeration).
 */
@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_IDENTITY_REPOSITORY)
    private readonly authIdentities: AuthIdentityRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(EMAIL_VERIFICATION_TOKEN_SERVICE)
    private readonly verificationTokens: EmailVerificationTokenService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  static validatePasswordStrength(password: string): boolean {
    if (password.length < 10) return false;
    if (COMMON_PASSWORDS.has(password.toLowerCase())) return false;
    return true;
  }

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (!RegisterUserUseCase.validatePasswordStrength(input.password)) {
      // Password strength IS validated at the DTO layer too (class-validator)
      // for fast feedback; this defensive check keeps the domain rule
      // enforced even if the use case is invoked from elsewhere (e.g. a
      // future admin-created-account path) — the rule lives once, per
      // Constitution §4.7, but both callers get told about it themselves.
      return GENERIC_RESULT;
    }

    const existing = await this.users.findByEmail(normalizedEmail);
    if (existing) {
      // AC: do not leak existence. Same generic response, no audit noise
      // that would distinguish this path from a "different" success path
      // by timing not the concern of this slice; noted in report.
      return GENERIC_RESULT;
    }

    const now = new Date();
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = User.register({
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash,
      now,
    });

    await this.users.save(user);

    const authIdentity = AuthIdentity.createPasswordIdentity({
      id: randomUUID(),
      userId: user.id,
      now,
    });
    await this.authIdentities.save(authIdentity);

    const verificationToken = this.verificationTokens.generate({
      userId: user.id,
      email: user.email,
    });
    await this.emailSender.sendVerificationEmail({
      to: user.email,
      token: verificationToken,
    });

    await this.auditLogger.record({
      actorUserId: user.id,
      action: 'user.registered',
      targetType: 'user',
      targetId: user.id,
      ipAddress: input.ipAddress,
    });

    return GENERIC_RESULT;
  }
}
