import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type {
  EmailVerificationTokenPayload,
  EmailVerificationTokenService,
} from '../../application/ports/email-verification-token.port';
import { parseDurationToSeconds } from '../../../../common/utils/parse-duration';

/**
 * Stub email-verification token: a signed, expiring JWT — no real email
 * provider wired (task scope explicitly allows this). Using the
 * platform's own JWT signing (not a third-party auth-as-a-service) keeps
 * this in-bounds per Constitution §11.3 (don't hand-roll auth/crypto —
 * this reuses @nestjs/jwt, doesn't reimplement signing).
 */
@Injectable()
export class JwtEmailVerificationTokenService implements EmailVerificationTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  generate(payload: EmailVerificationTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('EMAIL_VERIFICATION_SECRET'),
      expiresIn: parseDurationToSeconds(
        this.config.get<string>('EMAIL_VERIFICATION_EXPIRES_IN', '24h'),
      ),
    });
  }

  verify(token: string): EmailVerificationTokenPayload | null {
    try {
      return this.jwt.verify<EmailVerificationTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('EMAIL_VERIFICATION_SECRET'),
      });
    } catch {
      return null;
    }
  }
}
