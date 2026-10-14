import { FILAS, type FilaService, type MetaJobFila, type NomeFila, type OpcoesEnvio } from '@cardify/shared';
import PgBoss from 'pg-boss';
import { Pool } from 'pg';

const SCHEMA_PGBOSS = 'pgboss';
const EXPIRACAO_PADRAO_SEGUNDOS = 20 * 60;
const RETENCAO_PADRAO_DIAS = 7;
const RETRY_LIMIT_PADRAO = 3;

/** Campos extras do pg-boss que os testes e o worker podem precisar; o contrato `OpcoesEnvio` continua válido. */
export interface OpcoesEnvioFila extends OpcoesEnvio {
  retryBackoff?: boolean;
  retryDelaySegundos?: number;
}

export interface OpcoesFilaService {
  /** Intervalo de polling dos workers. Mínimo aceito pelo pg-boss: 0.5. */
  pollingIntervalSeconds?: number;
  /** Aguardo máximo (ms) do `parar()` por jobs em andamento. */
  timeoutParadaMs?: number;
}

/**
 * Dedup por `singletonKey` (política escolhida: `standard` + trava de aplicação).
 *
 * As políticas `short`/`singleton`/`stately` do pg-boss 10 indexam `COALESCE(singleton_key, '')`, então
 * jobs SEM chave passam a colidir entre si (apenas um pendente por fila) — inviável para uma fila de
 * trabalho comum. Além disso nenhuma delas cobre "criado OU em retry OU ativo" com a mesma chave:
 * `short` olha só `created`; `singleton` só `active`; `stately` permite um job por estado.
 * Por isso `enviar` abre uma transação, toma `pg_advisory_xact_lock(hash(fila, chave))`, consulta
 * created/retry/active e só então insere via `send(..., { db })` na mesma transação.
 */
export class PgBossFilaService implements FilaService {
  private boss: PgBoss | null = null;
  private pool: Pool | null = null;

  constructor(
    readonly connectionString: string,
    private readonly opcoes: OpcoesFilaService = {},
  ) {}

  async iniciar(): Promise<void> {
    if (this.boss) return;
    const boss = new PgBoss({ connectionString: this.connectionString, schema: SCHEMA_PGBOSS });
    boss.on('error', (erro) => console.error('[pg-boss]', erro));
    await boss.start();
    for (const fila of Object.values(FILAS)) {
      await boss.createQueue(fila, {
        name: fila,
        retryLimit: RETRY_LIMIT_PADRAO,
        retryBackoff: true,
        expireInSeconds: EXPIRACAO_PADRAO_SEGUNDOS,
        retentionDays: RETENCAO_PADRAO_DIAS,
      });
    }
    this.pool = new Pool({ connectionString: this.connectionString, max: 2 });
    this.pool.on('error', (erro) => console.error('[fila:pool]', erro));
    this.boss = boss;
  }

  async parar(): Promise<void> {
    const boss = this.boss;
    if (!boss) return;
    const pool = this.pool;
    this.boss = null;
    this.pool = null;
    await boss.stop({ graceful: true, timeout: this.opcoes.timeoutParadaMs ?? 30_000 });
    await pool?.end();
  }

  async enviar<T extends object>(fila: NomeFila, payload: T, opcoes: OpcoesEnvioFila = {}): Promise<string | null> {
    const boss = this.exigirBoss();
    const { singletonKey } = opcoes;

    const opcoesBoss: PgBoss.SendOptions = {
      retryLimit: opcoes.retryLimit ?? RETRY_LIMIT_PADRAO,
      retryBackoff: opcoes.retryBackoff ?? true,
      expireInSeconds: opcoes.expireInMinutes !== undefined ? opcoes.expireInMinutes * 60 : EXPIRACAO_PADRAO_SEGUNDOS,
      retentionDays: RETENCAO_PADRAO_DIAS,
    };
    if (opcoes.retryDelaySegundos !== undefined) opcoesBoss.retryDelay = opcoes.retryDelaySegundos;
    if (!singletonKey) return boss.send(fila, payload, opcoesBoss);

    opcoesBoss.singletonKey = singletonKey;
    const cliente = await this.pool!.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${fila}:${singletonKey}`]);
      const { rows } = await cliente.query(
        `SELECT 1 FROM ${SCHEMA_PGBOSS}.job WHERE name = $1 AND singleton_key = $2 AND state IN ('created', 'retry', 'active') LIMIT 1`,
        [fila, singletonKey],
      );
      if (rows.length > 0) {
        await cliente.query('ROLLBACK');
        return null;
      }
      const id = await boss.send(fila, payload, {
        ...opcoesBoss,
        db: { executeSql: async (texto, valores) => cliente.query(texto, valores) },
      });
      await cliente.query('COMMIT');
      return id;
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async processar<T extends object>(
    fila: NomeFila,
    handler: (payload: T, meta: MetaJobFila) => Promise<void>,
    opcoes: { concorrencia?: number } = {},
  ): Promise<void> {
    const boss = this.exigirBoss();
    const concorrencia = Math.max(1, Math.floor(opcoes.concorrencia ?? 1));
    // No pg-boss 10 não há `localConcurrency`: um lote com falha parcial falharia inteiro. Cada worker
    // pega um job por vez (batchSize 1) e a concorrência vem de registrar N workers.
    for (let i = 0; i < concorrencia; i++) {
      await boss.work<T>(
        fila,
        { batchSize: 1, pollingIntervalSeconds: this.opcoes.pollingIntervalSeconds ?? 2 },
        async ([job]) => {
          if (job) await handler(job.data, { id: job.id });
        },
      );
    }
  }

  private exigirBoss(): PgBoss {
    if (!this.boss) throw new Error('PgBossFilaService não iniciado: chame iniciar() antes.');
    return this.boss;
  }
}
