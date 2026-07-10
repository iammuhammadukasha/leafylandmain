import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/repositories/user.repository';
import {
  EMAIL_VERIFICATION_TOKEN_SERVICE,
  type EmailVerificationTokenService,
} from '../ports/email-verification-token.port';
import { AUDIT_LOGGER, type AuditLogger } from '../ports/audit-logger.port';
import { InvalidVerificationTokenError } from '../../domain/errors/identity.errors';

export interface VerifyEmailInput {
  token: string;
  ipAddress: string | null;
}

export interface VerifyEmailResult {
  message: string;
}

/**
 * FR-ID-001 — completes the register -> verify-email flow. Stub: token is
 * a signed value (no real email delivery), per task scope.
 */
@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_SERVICE)
    private readonly verificationTokens: EmailVerificationTokenService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: VerifyEmailInput): Promise<VerifyEmailResult> {
    const payload = this.verificationTokens.verify(input.token);
    if (!payload) {
      throw new InvalidVerificationTokenError();
    }

    const user = await this.users.findById(payload.userId);
    if (!user || user.email !== payload.email) {
      throw new InvalidVerificationTokenError();
    }

    const now = new Date();
    user.markEmailVerified(now);
    await this.users.save(user);

    await this.auditLogger.record({
      actorUserId: user.id,
      action: 'user.email_verified',
      targetType: 'user',
      targetId: user.id,
      ipAddress: input.ipAddress,
    });

    return { message: 'Email verified successfully.' };
  }
}
