import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

export async function criarApp(): Promise<NestFastifyApplication> {
  // rawBody: true é obrigatório para verificar assinatura de webhook (RFC §8).
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { rawBody: true });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  return app;
}
