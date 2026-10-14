import 'reflect-metadata';
import { bancoDeTeste } from '@cardify/db';
import { carregarEnv } from '@cardify/shared';
import { MemoriaStorageService } from '@cardify/storage';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { configurarApp } from '../bootstrap';
import { DB, ENV, FILA, POOL, PROGRESSO, RESOLVEDOR_SESSAO, STORAGE } from '../infra/tokens';
import { ResolvedorSessaoTeste } from '../sessao/resolvedor-teste';
import { FilaEmMemoria } from './fila-memoria';
import { ProgressoEmMemoria } from './progresso-memoria';

export interface AppTeste {
  app: NestFastifyApplication;
  banco: Awaited<ReturnType<typeof bancoDeTeste>>;
  storage: MemoriaStorageService;
  fila: FilaEmMemoria;
  progresso: ProgressoEmMemoria;
  fechar(): Promise<void>;
}

/**
 * App Nest completo para testes de integração: banco de teste real (migrado),
 * storage/fila/progresso em memória e sessão por headers `x-teste-user` / `x-teste-anon`.
 */
export async function criarAppTeste(ajustar?: (builder: TestingModuleBuilder) => TestingModuleBuilder): Promise<AppTeste> {
  const banco = await bancoDeTeste();
  const storage = new MemoriaStorageService();
  const fila = new FilaEmMemoria();
  const progresso = new ProgressoEmMemoria();

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(carregarEnv({ NODE_ENV: 'test' }))
    .overrideProvider(POOL)
    .useValue({ db: banco.db, pool: { end: async () => undefined } })
    .overrideProvider(DB)
    .useValue(banco.db)
    .overrideProvider(STORAGE)
    .useValue(storage)
    .overrideProvider(FILA)
    .useValue(fila)
    .overrideProvider(PROGRESSO)
    .useValue(progresso)
    .overrideProvider(RESOLVEDOR_SESSAO)
    .useValue(new ResolvedorSessaoTeste());
  if (ajustar) builder = ajustar(builder);

  const modulo = await builder.compile();
  const app = configurarApp(modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    banco,
    storage,
    fila,
    progresso,
    async fechar() {
      await app.close();
      await banco.fechar();
    },
  };
}
