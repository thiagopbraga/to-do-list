import {
  CANAL_PROGRESSO,
  ProgressoEventoSchema,
  type ProgressoEvento,
  type ProgressoPublisher,
  type ProgressoSubscriber,
} from '@cardify/shared';
import { Client, Pool } from 'pg';

/** NOTIFY aceita payload < 8000 bytes; sobra margem para o restante do JSON. */
const LIMITE_PAYLOAD_BYTES = 7500;
const RETICENCIAS = '…';

function serializar(evento: ProgressoEvento): string {
  const json = JSON.stringify(evento);
  if (Buffer.byteLength(json) <= LIMITE_PAYLOAD_BYTES) return json;

  const { mensagem = '', ...resto } = evento;
  const comCorte = (corte: number) => JSON.stringify({ ...resto, mensagem: mensagem.slice(0, corte) + RETICENCIAS });
  // O tamanho em bytes cresce com o corte (escapes e multibyte incluídos): busca binária do maior corte que cabe.
  let [baixo, alto] = [0, mensagem.length];
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    if (Buffer.byteLength(comCorte(meio)) <= LIMITE_PAYLOAD_BYTES) baixo = meio;
    else alto = meio - 1;
  }
  return Buffer.byteLength(comCorte(baixo)) <= LIMITE_PAYLOAD_BYTES ? comCorte(baixo) : JSON.stringify(resto);
}

/** Publica via NOTIFY no canal CANAL_PROGRESSO. */
export class PgProgressoPublisher implements ProgressoPublisher {
  private readonly pool: Pool;

  constructor(readonly connectionString: string) {
    this.pool = new Pool({ connectionString, max: 2 });
    this.pool.on('error', (erro) => console.error('[progresso:publisher]', erro));
  }

  async publicar(evento: ProgressoEvento): Promise<void> {
    const valido = ProgressoEventoSchema.parse(evento);
    await this.pool.query('SELECT pg_notify($1, $2)', [CANAL_PROGRESSO, serializar(valido)]);
  }

  async fechar(): Promise<void> {
    await this.pool.end();
  }
}

export interface OpcoesSubscriber {
  tentativasReconexao?: number;
  atrasoBaseMs?: number;
}

/** Uma conexão LISTEN compartilhada, despacha por jobId. */
export class PgProgressoSubscriber implements ProgressoSubscriber {
  static readonly APPLICATION_NAME = 'cardify-progresso-subscriber';

  private readonly callbacks = new Map<string, Set<(evento: ProgressoEvento) => void>>();
  private readonly tentativasMax: number;
  private readonly atrasoBaseMs: number;
  private client: Client | null = null;
  private conectando: Promise<void> | null = null;
  private timerReconexao: NodeJS.Timeout | null = null;
  private fechado = false;

  constructor(
    readonly connectionString: string,
    opcoes: OpcoesSubscriber = {},
  ) {
    this.tentativasMax = opcoes.tentativasReconexao ?? 5;
    this.atrasoBaseMs = opcoes.atrasoBaseMs ?? 500;
  }

  async assinar(jobId: string, aoReceber: (evento: ProgressoEvento) => void): Promise<() => Promise<void>> {
    if (this.fechado) throw new Error('PgProgressoSubscriber já fechado.');
    let conjunto = this.callbacks.get(jobId);
    if (!conjunto) {
      conjunto = new Set();
      this.callbacks.set(jobId, conjunto);
    }
    conjunto.add(aoReceber);

    try {
      await this.garantirConexao();
    } catch (erro) {
      this.remover(jobId, aoReceber);
      throw erro;
    }

    return async () => this.remover(jobId, aoReceber);
  }

  async fechar(): Promise<void> {
    this.fechado = true;
    if (this.timerReconexao) clearTimeout(this.timerReconexao);
    this.timerReconexao = null;
    this.callbacks.clear();
    await this.conectando?.catch(() => undefined);
    const client = this.client;
    this.client = null;
    if (client) {
      client.removeAllListeners();
      client.on('error', () => undefined);
      await client.end().catch(() => undefined);
    }
  }

  private remover(jobId: string, aoReceber: (evento: ProgressoEvento) => void): void {
    const conjunto = this.callbacks.get(jobId);
    if (!conjunto) return;
    conjunto.delete(aoReceber);
    if (conjunto.size === 0) this.callbacks.delete(jobId);
  }

  private garantirConexao(): Promise<void> {
    if (this.client) return Promise.resolve();
    this.conectando ??= this.conectar().finally(() => {
      this.conectando = null;
    });
    return this.conectando;
  }

  private async conectar(): Promise<void> {
    const client = new Client({
      connectionString: this.connectionString,
      application_name: PgProgressoSubscriber.APPLICATION_NAME,
    });
    client.on('notification', (msg) => this.despachar(msg.payload));
    // 'error' e 'end' costumam vir juntos; só a conexão ainda vigente dispara reconexão.
    const aoPerder = () => {
      if (this.client !== client) return;
      this.client = null;
      client.removeAllListeners();
      client.on('error', () => undefined);
      if (!this.fechado) this.agendarReconexao(0);
    };
    client.on('error', (erro) => {
      console.error('[progresso:subscriber]', erro);
      aoPerder();
    });
    client.on('end', aoPerder);

    try {
      await client.connect();
      await client.query(`LISTEN ${CANAL_PROGRESSO}`);
    } catch (erro) {
      client.removeAllListeners();
      client.on('error', () => undefined);
      await client.end().catch(() => undefined);
      throw erro;
    }
    if (this.fechado) {
      await client.end().catch(() => undefined);
      return;
    }
    this.client = client;
  }

  private agendarReconexao(tentativa: number): void {
    if (this.fechado || this.timerReconexao) return;
    if (tentativa >= this.tentativasMax) {
      console.error('[progresso:subscriber] reconexão esgotada; nova tentativa no próximo assinar()');
      return;
    }
    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      this.garantirConexao().catch((erro) => {
        console.error('[progresso:subscriber] falha ao reconectar', erro);
        this.agendarReconexao(tentativa + 1);
      });
    }, this.atrasoBaseMs * 2 ** tentativa);
  }

  private despachar(payload: string | undefined): void {
    if (!payload) return;
    let bruto: unknown;
    try {
      bruto = JSON.parse(payload);
    } catch {
      return;
    }
    const resultado = ProgressoEventoSchema.safeParse(bruto);
    if (!resultado.success) return;
    const destinatarios = this.callbacks.get(resultado.data.jobId);
    if (!destinatarios) return;
    for (const aoReceber of [...destinatarios]) {
      try {
        aoReceber(resultado.data);
      } catch (erro) {
        console.error('[progresso:subscriber] callback lançou', erro);
      }
    }
  }
}
