import { Injectable, Logger } from '@nestjs/common';
import type { EmailSender } from '../../application/ports/email-sender.port';

/**
 * Stub email sender — logs the "email" to console instead of sending it
 * (task scope: "doesn't need real email sending"). Swap for a real
 * provider adapter later without touching the application layer.
 */
@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger(ConsoleEmailSender.name);

  async sendVerificationEmail(params: {
    to: string;
    token: string;
  }): Promise<void> {
    this.logger.log(
      `[stub email] Verification link for ${params.to}: ` +
        `/api/v1/auth/verify-email?token=${params.token}`,
    );
    await Promise.resolve();
  }
}
