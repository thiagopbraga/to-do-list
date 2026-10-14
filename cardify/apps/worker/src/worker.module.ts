import { Module } from '@nestjs/common';
import { criarDb } from '@cardify/db';
import { criarLlmProvider } from '@cardify/generation';
import { PgBossFilaService, PgProgressoPublisher } from '@cardify/queue';
import { carregarEnv, type Env } from '@cardify/shared';
import { S3StorageService } from '@cardify/storage';
import { ConsumidorService } from './consumidor.service';
import { ObservabilidadeModule } from './observabilidade/observabilidade.module';
import { PipelineService } from './pipeline.service';
import { RetencaoService } from './retencao/retencao.service';
import { DB, ENV, FILA, LLM_PROVIDER, POOL, PUBLICADOR, STORAGE } from './tokens';

/** Testes substituem cada token com `overrideProvider(TOKEN).useValue(...)`. */
@Module({
  imports: [ObservabilidadeModule],
  providers: [
    { provide: ENV, useFactory: () => carregarEnv() },
    { provide: POOL, inject: [ENV], useFactory: (env: Env) => criarDb(env.DATABASE_URL) },
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
    { provide: PUBLICADOR, inject: [ENV], useFactory: (env: Env) => new PgProgressoPublisher(env.DATABASE_URL) },
    { provide: LLM_PROVIDER, inject: [ENV], useFactory: (env: Env) => criarLlmProvider(env) },
    PipelineService,
    ConsumidorService,
    RetencaoService,
  ],
})
export class WorkerModule {}
