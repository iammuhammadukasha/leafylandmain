import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookSignatureVerifierPort } from '../../application/ports/payment-gateway.port';

/**
 * REAL HMAC-SHA256 webhook signature verification (BR-ORD-01) — this is
 * the one part of the payment integration that is NOT stubbed. Matches
 * Razorpay's actual documented webhook verification scheme exactly:
 * `X-Razorpay-Signature` header = hex(HMAC-SHA256(rawRequestBody,
 * webhookSecret)). See
 * https://razorpay.com/docs/webhooks/validate-test/ — "Razorpay signs the
 * webhook payload using the secret... and adds it to the
 * X-Razorpay-Signature header. On your end, generate a signature using
 * the same algorithm... and compare."
 *
 * The secret is read from config (RAZORPAY_WEBHOOK_SECRET), never
 * hardcoded (Constitution §4.8). Comparison uses `timingSafeEqual` (not
 * `===` or simple string compare) to avoid leaking signature-match
 * information via response-time side channels — a genuine security
 * property, not just style.
 */
@Injectable()
export class RazorpayWebhookSigner implements WebhookSignatureVerifierPort {
  constructor(private readonly config: ConfigService) {}

  verify(rawBody: string, signatureHeader: string | undefined): boolean {
    // Signature must be exactly 64 lowercase-or-uppercase hex chars (a
    // SHA-256 digest). This is checked as a STRING before any hex
    // decoding: Buffer.from(str, 'hex') silently truncates at the first
    // malformed/incomplete byte pair instead of throwing, so e.g. a
    // correct signature with one extra trailing character would
    // otherwise decode to the same bytes as the correct one and pass
    // timingSafeEqual. Validating the raw string shape first closes that
    // gap regardless of what Buffer.from does with malformed input.
    if (!signatureHeader || !/^[0-9a-fA-F]{64}$/.test(signatureHeader)) {
      return false;
    }

    const expected = RazorpayWebhookSigner.sign(
      rawBody,
      this.config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET'),
    );

    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signatureHeader, 'hex');

    return timingSafeEqual(expectedBuf, actualBuf);
  }

  /**
   * Shared static helper — also used by the test-helper CLI
   * (`scripts/sign-razorpay-webhook.ts`) so a real webhook payload can be
   * signed the exact same way this class verifies it, for genuine
   * end-to-end signature testing (not "assume it works").
   */
  static sign(rawBody: string, secret: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }
}
