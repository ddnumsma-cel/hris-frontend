import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { text } from 'express';
import { AppModule } from './app.module';

/** Browsers allowed to call the API: local web app, Expo dev tools and private LAN addresses. */
const allowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+(:\d+)?$/,
];

export async function createApp(
  options: { logger?: boolean } = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: options.logger === false ? false : ['log', 'warn', 'error'],
  });
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.disable('x-powered-by');
  // Baseline security headers (the API only serves JSON and document files).
  app.use((_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  // Biometric terminals (ZKTeco ADMS) post plain-text bodies, sometimes without a proper content type.
  app.use('/iclock', text({ type: () => true, limit: '1mb' }));
  app.enableShutdownHooks();
  return app;
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('MSMA HRIS API')
    .setDescription(
      'Sample HRIS API for MSMA Solutions. Synthetic data only. Money is PHP as decimal strings; times are UTC ISO-8601.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, doc);
}
