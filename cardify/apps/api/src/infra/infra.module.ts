import { Global, Inject, Module, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { criarDb } from '@cardify/db';
import { PgBossFilaService, PgProgressoSubscriber } from '@cardify/queue';
import { carregarEnv, type Env, type FilaService } from '@cardify/shared';
import { S3StorageService } from '@cardify/storage';
import type { Pool } from 'pg';
import { DB, ENV, FILA, POOL, PROGRESSO, STORAGE } from './tokens';

/**
 * Dependências de infraestrutura da API. Testes substituem cada token com
 * `overrideProvider(TOKEN).useValue(...)` (ex.: MemoriaStorageService, fila em memória).
 */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => carregarEnv() },
    {
      provide: POOL,
      inject: [ENV],
      useFactory: (env: Env) => criarDb(env.DATABASE_URL),
    },
    { provide: DB, inject: [POOL], useFactory: (conexao: ReturnType<typeof criarDb>) => conexao.db },
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env) =>
        new S3StorageService({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
        }),
    },
    { provide: FILA, inject: [ENV], useFactory: (env: Env) => new PgBossFilaService(env.DATABASE_URL) },
    { provide: PROGRESSO, inject: [ENV], useFactory: (env: Env) => new PgProgressoSubscriber(env.DATABASE_URL) },
  ],
  exports: [ENV, POOL, DB, STORAGE, FILA, PROGRESSO],
})
export class InfraModule implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(FILA) private readonly fila: FilaService,
    @Inject(POOL) private readonly conexao: { pool: Pool },
    @Inject(PROGRESSO) private readonly progresso: { fechar?: () => Promise<void> },
  ) {}

  async onModuleInit() {
    await this.fila.iniciar();
  }

  async onApplicationShutdown() {
    await this.fila.parar();
    await this.progresso.fechar?.();
    await this.conexao.pool?.end();
  }
}
