import { ConfigService } from '@nestjs/config';
import { RazorpayWebhookSigner } from '../razorpay-webhook-signer';

function buildSigner(secret: string): RazorpayWebhookSigner {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'RAZORPAY_WEBHOOK_SECRET') return secret;
      throw new Error(`unexpected config key ${key}`);
    },
  } as unknown as ConfigService;
  return new RazorpayWebhookSigner(config);
}

describe('RazorpayWebhookSigner', () => {
  const secret = 'test-webhook-secret';

  it('accepts a signature produced by the same HMAC-SHA256(rawBody, secret) scheme', () => {
    const signer = buildSigner(secret);
    const rawBody = JSON.stringify({
      razorpayOrderId: 'order_stub_abc',
      razorpayPaymentId: 'pay_abc',
    });
    const signature = RazorpayWebhookSigner.sign(rawBody, secret);

    expect(signer.verify(rawBody, signature)).toBe(true);
  });

  it('rejects a tampered signature (single character changed)', () => {
    const signer = buildSigner(secret);
    const rawBody = JSON.stringify({
      razorpayOrderId: 'order_stub_abc',
      razorpayPaymentId: 'pay_abc',
    });
    const signature = RazorpayWebhookSigner.sign(rawBody, secret);
    const tampered =
      signature.slice(0, -1) + (signature.at(-1) === 'a' ? 'b' : 'a');

    expect(signer.verify(rawBody, tampered)).toBe(false);
  });

  it('rejects a signature produced with the wrong secret', () => {
    const signer = buildSigner(secret);
    const rawBody = JSON.stringify({ razorpayOrderId: 'order_stub_abc' });
    const wrongSignature = RazorpayWebhookSigner.sign(
      rawBody,
      'a-completely-different-secret',
    );

    expect(signer.verify(rawBody, wrongSignature)).toBe(false);
  });

  it('rejects when a signature header is missing', () => {
    const signer = buildSigner(secret);
    expect(signer.verify('{}', undefined)).toBe(false);
  });

  it('rejects when the raw body is tampered with (different bytes signed)', () => {
    const signer = buildSigner(secret);
    const originalBody = JSON.stringify({ amount: 100 });
    const signature = RazorpayWebhookSigner.sign(originalBody, secret);
    const tamperedBody = JSON.stringify({ amount: 999 });

    expect(signer.verify(tamperedBody, signature)).toBe(false);
  });

  it('rejects a correct signature with a trailing character appended', () => {
    // Regression test: Buffer.from(str, 'hex') silently truncates at the
    // first malformed/incomplete byte pair instead of throwing, so
    // without an explicit shape check a correct signature plus garbage
    // would decode to the same bytes as the correct one and pass
    // timingSafeEqual. Caught via independent verification against a
    // live server (not by the pre-existing single-char-substitution
    // test above, which never changes the string's length).
    const signer = buildSigner(secret);
    const rawBody = JSON.stringify({
      razorpayOrderId: 'order_stub_abc',
      razorpayPaymentId: 'pay_abc',
    });
    const signature = RazorpayWebhookSigner.sign(rawBody, secret);

    expect(signer.verify(rawBody, `${signature}0`)).toBe(false);
  });

  it('rejects a non-hex signature header', () => {
    const signer = buildSigner(secret);
    const rawBody = JSON.stringify({ razorpayOrderId: 'order_stub_abc' });

    expect(signer.verify(rawBody, 'not-a-valid-hex-signature')).toBe(false);
  });
});
