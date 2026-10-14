import fastifyCookie from '@fastify/cookie';
import { carregarEnv, type Env } from '@cardify/shared';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ErrosDominioFilter } from './comum/erros.filter';
import { ENV } from './infra/tokens';

/** Configuração comum à aplicação real e aos testes. */
export async function configurarApp(app: NestFastifyApplication): Promise<NestFastifyApplication> {
  // O @nestjs/platform-fastify traz uma cópia própria dos tipos do fastify; o cast só contorna essa duplicação.
  await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0], {
    secret: app.get<Env>(ENV).SESSION_SECRET,
  });
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new ErrosDominioFilter());
  app.enableShutdownHooks();
  return app;
}

export async function criarApp(): Promise<NestFastifyApplication> {
  // rawBody: true é obrigatório para verificar assinatura de webhook (RFC §8).
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: carregarEnv().TRUST_PROXY }),
    { rawBody: true },
  );
  return configurarApp(app);
}
