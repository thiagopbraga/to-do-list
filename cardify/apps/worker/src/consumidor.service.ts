import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { FILAS, type Env, type FilaService, type PayloadGerarBaralho, type ProgressoPublisher } from '@cardify/shared';
import type { Pool } from 'pg';
import { PipelineService } from './pipeline.service';
import { ENV, FILA, POOL, PUBLICADOR } from './tokens';

const CONCORRENCIA = 2;
const INTERVALO_VARREDURA_MS = 5 * 60 * 1000;

@Injectable()
export class ConsumidorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(ConsumidorService.name);
  private varredura: NodeJS.Timeout | undefined;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(FILA) private readonly fila: FilaService,
    @Inject(POOL) private readonly conexao: { pool: Pool },
    @Inject(PUBLICADOR) private readonly publicador: ProgressoPublisher & { fechar?: () => Promise<void> },
    private readonly pipeline: PipelineService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.fila.iniciar();
    await this.fila.processar<PayloadGerarBaralho>(FILAS.gerarBaralho, (payload) => this.pipeline.executar(payload.jobId), {
      concorrencia: CONCORRENCIA,
    });

    // Nos testes a varredura é chamada direto (`PipelineService.varrerZumbis`).
    if (this.env.NODE_ENV !== 'test') {
      this.varredura = setInterval(() => {
        this.pipeline.varrerZumbis().catch((erro) => this.log.error(`varredura de zumbis falhou: ${String(erro)}`));
      }, INTERVALO_VARREDURA_MS);
      this.varredura.unref();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.varredura);
    await this.fila.parar();
    await this.publicador.fechar?.();
    await this.conexao.pool?.end();
  }
}
