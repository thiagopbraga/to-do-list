import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { type Db, sql } from '@cardify/db';
import { FILAS, type Env } from '@cardify/shared';
import { DB, ENV } from '../tokens';

export const INTERVALO_ALERTAS_MS = 5 * 60 * 1000;
const REENVIO_ALERTA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const MEDICOES_CRESCENTES = 3;
const MINIMO_JOBS_TAXA_FALHA = 20;
const LIMITE_TAXA_FALHA = 0.05;

type Detalhe = Record<string, unknown>;

/**
 * Alertas do RFC §10 emitidos como `logger.error({ alerta, ... })`. Cada alerta sai no máximo uma vez por hora.
 * O histórico de profundidade da fila é em memória: reiniciar o worker zera a contagem de medições seguidas.
 */
@Injectable()
export class AlertasService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(AlertasService.name);
  private readonly ultimoEmitido = new Map<string, number>();
  private readonly profundidades: number[] = [];
  private intervalo: NodeJS.Timeout | undefined;

  constructor(private readonly moduleRef: ModuleRef) {}

  onApplicationBootstrap(): void {
    if (this.env().NODE_ENV === 'test') return;
    this.intervalo = setInterval(() => {
      this.verificar().catch((erro) => this.log.warn(`verificação de alertas falhou: ${String(erro)}`));
    }, INTERVALO_ALERTAS_MS);
    this.intervalo.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.intervalo);
  }

  /** Roda as três checagens e devolve os nomes dos alertas emitidos nesta chamada. */
  async verificar(agora: Date = new Date()): Promise<string[]> {
    const checagens: Array<[string, () => Promise<Detalhe | null>]> = [
      ['gasto_diario', () => this.gastoDiario(agora)],
      ['fila_crescente', () => this.filaCrescente()],
      ['falha_jobs', () => this.falhaJobs(agora)],
    ];

    const emitidos: string[] = [];
    for (const [nome, checar] of checagens) {
      try {
        const detalhe = await checar();
        if (detalhe && this.podeEmitir(nome, agora)) {
          this.ultimoEmitido.set(nome, agora.getTime());
          this.log.error({ alerta: nome, ...detalhe });
          emitidos.push(nome);
        }
      } catch (erro) {
        this.log.warn(`checagem ${nome} falhou: ${String(erro)}`);
      }
    }
    return emitidos;
  }

  private podeEmitir(nome: string, agora: Date): boolean {
    const ultimo = this.ultimoEmitido.get(nome);
    return ultimo === undefined || agora.getTime() - ultimo >= REENVIO_ALERTA_MS;
  }

  private async gastoDiario(agora: Date): Promise<Detalhe | null> {
    const inicio = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
    const { rows } = await this.db().execute<{ gasto: number }>(sql`
      SELECT COALESCE(SUM(l.custo_centavos), 0)::float8 AS gasto
      FROM llm_calls l
      WHERE l.created_at >= ${new Date(inicio)} AND l.created_at < ${new Date(inicio + DIA_MS)}`);
    const gasto = Number(rows[0].gasto);
    const limite = this.env().ALERTA_GASTO_DIARIO_CENTAVOS;
    if (gasto <= limite) return null;
    return { dia: new Date(inicio).toISOString().slice(0, 10), gastoCentavos: gasto, limiteCentavos: limite };
  }

  private async filaCrescente(): Promise<Detalhe | null> {
    const { rows } = await this.db().execute<{ profundidade: number }>(sql`
      SELECT COUNT(*)::int AS profundidade
      FROM pgboss.job
      WHERE name = ${FILAS.gerarBaralho} AND state IN ('created', 'retry')`);
    this.profundidades.push(Number(rows[0].profundidade));
    if (this.profundidades.length > MEDICOES_CRESCENTES) this.profundidades.shift();

    const medicoes = this.profundidades;
    if (medicoes.length < MEDICOES_CRESCENTES) return null;
    const crescente = medicoes.every((valor, i) => i === 0 || valor > medicoes[i - 1]);
    if (!crescente) return null;
    return { fila: FILAS.gerarBaralho, medicoes: [...medicoes], intervaloMinutos: INTERVALO_ALERTAS_MS / 60_000 };
  }

  private async falhaJobs(agora: Date): Promise<Detalhe | null> {
    const desde = new Date(agora.getTime() - 60 * 60 * 1000);
    const { rows } = await this.db().execute<{ falhas: number; total: number }>(sql`
      SELECT COUNT(*) FILTER (WHERE j.status = 'falhou')::int AS falhas,
             COUNT(*)::int AS total
      FROM jobs j
      WHERE j.status IN ('concluido', 'parcial', 'falhou')
        AND j.finished_at >= ${desde} AND j.finished_at <= ${agora}`);
    const falhas = Number(rows[0].falhas);
    const total = Number(rows[0].total);
    if (total < MINIMO_JOBS_TAXA_FALHA || falhas <= LIMITE_TAXA_FALHA * total) return null;
    return { falhas, total, taxa: falhas / total, janela: 'ultima_hora' };
  }

  private env(): Env {
    return this.moduleRef.get<Env>(ENV, { strict: false });
  }

  private db(): Db {
    return this.moduleRef.get<Db>(DB, { strict: false });
  }
}
