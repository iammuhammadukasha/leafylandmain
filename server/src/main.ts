import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';

async function bootstrap(): Promise<void> {
  // rawBody: true — exposes `request.rawBody` (raw Buffer) alongside the
  // parsed JSON body. Needed by the Orders webhook endpoint
  // (POST /api/v1/orders/webhooks/razorpay, BR-ORD-01) to verify the
  // HMAC-SHA256 signature against the exact bytes Razorpay signed, not a
  // re-serialized version of the parsed object (which can differ in key
  // order/whitespace and would make every signature check fail).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  // Constitution §8: input validation on every endpoint. whitelist strips
  // unknown properties, forbidNonWhitelisted rejects requests carrying
  // them instead of silently dropping (fails loud on API misuse).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  // Global ThrottlerGuard is bound as an APP_GUARD provider in AppModule
  // (Constitution §8: rate limiting mechanism wired globally); per-route
  // overrides via @Throttle() (see AuthController).

  const config = new DocumentBuilder()
    .setTitle('LeafyLand v2 API')
    .setDescription(
      'Identity + User foundation-phase vertical slice (Volume 07 API Specifications)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`LeafyLand v2 API listening on http://localhost:${port}`);

  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();
