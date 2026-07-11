/**
 * Dev/test helper: signs a fake Razorpay webhook payload exactly the way
 * RazorpayWebhookSigner verifies it (HMAC-SHA256 of the raw JSON body,
 * hex digest), so BR-ORD-01's verify-then-reject-invalid-signature path
 * can be exercised for real against the live server, not just assumed.
 *
 * Usage (from server/):
 *   npx ts-node scripts/sign-razorpay-webhook.ts <razorpayOrderId> <razorpayPaymentId>
 *
 * Prints:
 *   BODY=<raw json body to POST>
 *   SIGNATURE=<X-Razorpay-Signature header value>
 *
 * Reads RAZORPAY_WEBHOOK_SECRET from server/.env (must match what the
 * running server has configured) via dotenv, same secret source as
 * RazorpayWebhookSigner itself.
 */
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';
import { RazorpayWebhookSigner } from '../src/modules/orders/infrastructure/payment/razorpay-webhook-signer';

loadEnv({ path: join(__dirname, '..', '.env') });

function main(): void {
  const [razorpayOrderId, razorpayPaymentId] = process.argv.slice(2);
  if (!razorpayOrderId || !razorpayPaymentId) {
    console.error(
      'Usage: ts-node scripts/sign-razorpay-webhook.ts <razorpayOrderId> <razorpayPaymentId>',
    );
    process.exit(1);
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set in server/.env');
    process.exit(1);
  }

  const body = JSON.stringify({ razorpayOrderId, razorpayPaymentId });
  const signature = RazorpayWebhookSigner.sign(body, secret);

  console.log(`BODY=${body}`);
  console.log(`SIGNATURE=${signature}`);
}

main();
