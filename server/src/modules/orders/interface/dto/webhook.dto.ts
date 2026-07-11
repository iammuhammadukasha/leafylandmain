import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Shape of the webhook body this stub integration accepts (task
 * instruction: "body is the 'webhook payload' (order id + signature in
 * whatever shape you designed the stub gateway to produce)"). A real
 * Razorpay webhook payload is considerably richer (event type, nested
 * payment/order entities, etc.) — this is a deliberately minimal stand-in
 * carrying just the two fields ProcessRazorpayWebhookUseCase needs
 * (matches scripts/sign-razorpay-webhook.ts's fixture shape exactly, so
 * the two stay in lockstep).
 */
export class RazorpayWebhookDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpayOrderId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpayPaymentId!: string;
}
