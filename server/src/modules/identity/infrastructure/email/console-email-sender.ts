import { Injectable, Logger } from '@nestjs/common';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EmailSender } from '../../application/ports/email-sender.port';

/**
 * Stub email sender — logs the "email" to console instead of sending it
 * (task scope: "doesn't need real email sending"). Swap for a real
 * provider adapter later without touching the application layer.
 *
 * Also drops the latest link into a gitignored dev-only file
 * (.local/last-verification-link.txt) so it can be read back without
 * scrolling terminal output — local dev convenience only, never read by
 * application code.
 */
@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger(ConsoleEmailSender.name);

  async sendVerificationEmail(params: {
    to: string;
    token: string;
  }): Promise<void> {
    const link = `/api/v1/auth/verify-email?token=${params.token}`;
    this.logger.log(`[stub email] Verification link for ${params.to}: ${link}`);

    try {
      const dir = join(process.cwd(), '.local');
      await writeFile(
        join(dir, 'last-verification-link.txt'),
        `${params.to}\t${params.token}\t${new Date().toISOString()}\n`,
        { flag: 'a' },
      ).catch(async (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          const { mkdir } = await import('node:fs/promises');
          await mkdir(dir, { recursive: true });
          await writeFile(
            join(dir, 'last-verification-link.txt'),
            `${params.to}\t${params.token}\t${new Date().toISOString()}\n`,
            { flag: 'a' },
          );
        } else {
          throw err;
        }
      });
    } catch {
      // Dev convenience only — never let this fail the registration flow.
    }
  }
}
