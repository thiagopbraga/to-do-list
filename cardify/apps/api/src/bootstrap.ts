import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ErrosDominioFilter } from './comum/erros.filter';

/** Configuração comum à aplicação real e aos testes. */
export function configurarApp(app: NestFastifyApplication): NestFastifyApplication {
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new ErrosDominioFilter());
  app.enableShutdownHooks();
  return app;
}

export async function criarApp(): Promise<NestFastifyApplication> {
  // rawBody: true é obrigatório para verificar assinatura de webhook (RFC §8).
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { rawBody: true });
  return configurarApp(app);
}
