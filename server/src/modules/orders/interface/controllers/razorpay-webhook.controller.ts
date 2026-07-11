import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProcessRazorpayWebhookUseCase } from '../../application/use-cases/process-razorpay-webhook.use-case';
import { RazorpayWebhookDto } from '../dto/webhook.dto';
import { mapOrderError } from '../order-error.mapper';

/**
 * POST /api/v1/orders/webhooks/razorpay (Volume 07 §6.2, FR-ORD-003,
 * BR-ORD-01). Deliberately NOT decorated with `@UseGuards(JwtAuthGuard)` —
 * per API Spec §6.2's note, "Public" here means "no user session," not
 * "unauthenticated": this handler performs its OWN mandatory signature
 * verification (inside ProcessRazorpayWebhookUseCase, via
 * WebhookSignatureVerifierPort) against the raw request body before
 * trusting anything in the payload. This is the ONLY code path in the
 * entire system allowed to set an order's status to `paid`.
 *
 * Uses `request.rawBody` (enabled via `NestFactory.create(AppModule,
 * { rawBody: true })` in main.ts) rather than re-serializing the
 * ValidationPipe-parsed `RazorpayWebhookDto` back to JSON — HMAC
 * verification must run against the EXACT bytes that were signed;
 * re-serializing risks key-order/whitespace differences that would break
 * every signature check.
 */
@ApiTags('webhooks')
@Controller('api/v1/orders/webhooks')
export class RazorpayWebhookController {
  constructor(private readonly processWebhook: ProcessRazorpayWebhookUseCase) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Razorpay payment webhook — signature-verified, sets order to paid (FR-ORD-003, BR-ORD-01)',
    description:
      'Verifies X-Razorpay-Signature (HMAC-SHA256 of the raw body) before trusting the payload. Invalid signature -> 401 INVALID_WEBHOOK_SIGNATURE, logged as a security event, no order state changed. Valid + already-paid order -> 200 no-op (idempotent retry handling).',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'INVALID_WEBHOOK_SIGNATURE' })
  async handler(
    @Body() _dto: RazorpayWebhookDto,
    @Req() request: Request & { rawBody?: Buffer },
    @Ip() ip: string,
  ): Promise<{ orderId: string; status: string }> {
    const rawBody = request.rawBody ? request.rawBody.toString('utf8') : '';
    const signatureHeader = request.headers['x-razorpay-signature'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    try {
      // Parse the payload ourselves from rawBody (rather than trusting
      // the ValidationPipe-parsed `_dto`) so the exact bytes verified are
      // the exact bytes interpreted — belt-and-braces, though in practice
      // Express's json() parser already produced `_dto` from these same
      // bytes.
      const payload = JSON.parse(rawBody) as {
        razorpayOrderId: string;
        razorpayPaymentId: string;
      };

      const result = await this.processWebhook.execute({
        rawBody,
        signatureHeader: signature,
        payload,
        ipAddress: ip,
      });
      return result;
    } catch (error) {
      throw mapOrderError(error);
    }
  }
}
