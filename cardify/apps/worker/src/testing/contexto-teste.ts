import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  anonSessions,
  bancoDeTeste,
  documents,
  jobs,
  reservarECriarJob,
  users,
  type JobRow,
} from '@cardify/db';
import { FakeLlmProvider } from '@cardify/generation';
import {
  carregarEnv,
  type FilaService,
  type LlmProvider,
  type LlmRequisicao,
  type LlmResposta,
  type ProgressoEvento,
  type ProgressoPublisher,
} from '@cardify/shared';
import { MemoriaStorageService } from '@cardify/storage';
import { Test } from '@nestjs/testing';
import { PipelineService } from '../pipeline.service';
import { DB, ENV, FILA, LLM_PROVIDER, POOL, PUBLICADOR, STORAGE } from '../tokens';
import { WorkerModule } from '../worker.module';

export const PARAMETROS = { densidade: 'equilibrado', tipo: 'misto', area: 'geral' } as const;

const RAIZ_FIXTURES = resolve(__dirname, '../../../../fixtures');

export function lerFixture(caminho: string): Buffer {
  return readFileSync(resolve(RAIZ_FIXTURES, caminho));
}

export class ColetorProgresso implements ProgressoPublisher {
  readonly eventos: ProgressoEvento[] = [];
  falhar = false;

  async publicar(evento: ProgressoEvento): Promise<void> {
    if (this.falhar) throw new Error('publicação indisponível');
    this.eventos.push(evento);
  }

  doJob(jobId: string): ProgressoEvento[] {
    return this.eventos.filter((e) => e.jobId === jobId);
  }
}

/** Fila que não consome nada: os testes chamam `pipeline.executar` direto. */
export class FilaInerte implements FilaService {
  iniciada = false;
  parada = false;
  processadores: Array<{ fila: string; concorrencia?: number }> = [];

  async iniciar(): Promise<void> {
    this.iniciada = true;
  }
  async parar(): Promise<void> {
    this.parada = true;
  }
  async enviar(): Promise<string | null> {
    return null;
  }
  async processar(fila: string, _handler: unknown, opcoes?: { concorrencia?: number }): Promise<void> {
    this.processadores.push({ fila, concorrencia: opcoes?.concorrencia });
  }
}

/** Provider fake que se apresenta como um modelo cobrado, para gerar custo e gasto anônimo. */
export class ProviderCobrado implements LlmProvider {
  chamadas = 0;
  private readonly interno = new FakeLlmProvider();

  constructor(
    private readonly opcoes: { modelo?: string; multiplicadorTokens?: number } = {},
  ) {}

  async completar(req: LlmRequisicao): Promise<LlmResposta> {
    this.chamadas++;
    const resposta = await this.interno.completar(req);
    const m = this.opcoes.multiplicadorTokens ?? 1;
    return {
      ...resposta,
      modelo: this.opcoes.modelo ?? 'claude-haiku-5-5',
      tokensIn: resposta.tokensIn * m,
      tokensOut: resposta.tokensOut * m,
    };
  }
}

/** Falha nas primeiras `falhas` chamadas (Infinity = sempre) e depois delega ao fake. */
export class ProviderQueFalha implements LlmProvider {
  chamadas = 0;
  private readonly interno = new FakeLlmProvider();

  constructor(public falhas: number) {}

  async completar(req: LlmRequisicao): Promise<LlmResposta> {
    this.chamadas++;
    if (this.falhas > 0) {
      this.falhas--;
      throw new Error('LLM indisponível');
    }
    return this.interno.completar(req);
  }
}

export async function criarContextoTeste(provider: LlmProvider = new FakeLlmProvider()) {
  const banco = await bancoDeTeste();
  const storage = new MemoriaStorageService();
  const publicador = new ColetorProgresso();
  const fila = new FilaInerte();

  const modulo = await Test.createTestingModule({ imports: [WorkerModule] })
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
    .overrideProvider(PUBLICADOR)
    .useValue(publicador)
    .overrideProvider(LLM_PROVIDER)
    .useValue(provider)
    .compile();

  return {
    modulo,
    banco,
    db: banco.db,
    storage,
    publicador,
    fila,
    pipeline: modulo.get(PipelineService),
    async fechar() {
      await modulo.close();
      await banco.fechar();
    },
  };
}

export type ContextoTeste = Awaited<ReturnType<typeof criarContextoTeste>>;

export interface OpcoesJobTeste {
  tipo: 'pdf' | 'texto';
  conteudo: Buffer | string;
  /** Sem `anonimo`, o dono é um usuário com cota reservada (`estimativa` cards). */
  anonimo?: boolean;
  estimativa?: number;
  orcamentoCentavos?: number;
  nome?: string;
}

export async function criarJobTeste(ctx: ContextoTeste, opcoes: OpcoesJobTeste): Promise<JobRow> {
  const { db } = ctx;
  const storageKey = `docs/teste/${Math.random().toString(36).slice(2)}`;
  await ctx.storage.gravar(storageKey, opcoes.conteudo, opcoes.tipo === 'pdf' ? 'application/pdf' : 'text/plain');

  const donoDocumento = async () => {
    if (opcoes.anonimo) {
      const [s] = await db
        .insert(anonSessions)
        .values({ ipHash: 'ip', expiresAt: new Date(Date.now() + 86_400_000) })
        .returning();
      return { userId: null, anonSessionId: s.id };
    }
    const [u] = await db
      .insert(users)
      .values({ email: `u${Math.random().toString(36).slice(2)}@exemplo.com` })
      .returning();
    return { userId: u.id, anonSessionId: null };
  };
  const dono = await donoDocumento();

  const [documento] = await db
    .insert(documents)
    .values({
      ...dono,
      tipo: opcoes.tipo,
      sha256: 'a'.repeat(64),
      nome: opcoes.nome ?? 'material',
      storageKey,
      status: 'enviado',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();

  const valores = (reservado: number) => ({
    ...dono,
    documentId: documento.id,
    status: 'pendente' as const,
    params: PARAMETROS,
    paramsHash: 'h',
    amostra: !!opcoes.anonimo,
    orcamentoCentavos: opcoes.orcamentoCentavos ?? 1000,
    cardsReservados: reservado,
  });

  if (dono.userId) {
    let criado: JobRow | undefined;
    await reservarECriarJob(db, {
      userId: dono.userId,
      estimativa: opcoes.estimativa ?? 40,
      criarJob: async (tx, reservado) => {
        [criado] = await tx.insert(jobs).values(valores(reservado)).returning();
        return criado as JobRow;
      },
    });
    return criado as unknown as JobRow;
  }
  const [job] = await db.insert(jobs).values(valores(10)).returning();
  return job;
}

/** Texto com `paragrafos` parágrafos distintos (o dedup não os funde), grande o bastante para vários chunks. */
export function textoLongo(paragrafos: number): string {
  return Array.from(
    { length: paragrafos },
    (_, i) =>
      `O conceito número ${i} da disciplina estabelece que o fenômeno ${i * 7 + 3} depende de ${i * 13 + 5} fatores independentes. ` +
      `Segundo a teoria ${i}, a variável ${String.fromCharCode(97 + (i % 26))}${i} aumenta quando o parâmetro ${i * 3 + 1} diminui em ${i + 2} unidades. ` +
      `Por consequência, o experimento ${i} demonstrou que a razão entre ${i + 11} e ${i + 17} permanece constante durante toda a observação.`,
  ).join('\n\n');
}

/** Poucas frases longas e sem repetição de vocabulário: vários chunks com poucos fatos cada. */
export function textoEsparso(frases: number, palavrasPorFrase = 110): string {
  const palavra = (i: number, j: number) => ((i + 1) * 7919 + (j + 1) * 104729 + i * j * 31).toString(36).padStart(5, 'q');
  return Array.from({ length: frases }, (_, i) =>
    `${Array.from({ length: palavrasPorFrase }, (_, j) => palavra(i, j)).join(' ')}.`,
  ).join('\n\n');
}
