import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type ChunkRow,
  type Db,
  type JobRow,
  LedgerLlmDb,
  and,
  asc,
  cards,
  chunks,
  confirmarCota,
  documents,
  eq,
  jobs,
  liberarReserva,
  llmCalls,
  sql,
} from '@cardify/db';
import { LlmClienteRegistrado, OrcamentoJob, gerarCards, modeloPorTier } from '@cardify/generation';
import { ingerirPdfIsolado, ingerirTexto } from '@cardify/ingest';
import {
  DocumentoInvalidoError,
  JOB_STATUS_FINAIS,
  LIMITES_ANONIMO,
  LIMITES_DOCUMENTO,
  type Env,
  type Estagio,
  type JobStatus,
  type LlmProvider,
  type ProgressoPublisher,
  type ResultadoIngestao,
  type StorageService,
} from '@cardify/shared';
import { DB, ENV, LLM_PROVIDER, PUBLICADOR, STORAGE } from './tokens';

/** 1 execução + `retryLimit` 3 da fila. */
export const MAX_TENTATIVAS = 4;
export const MINUTOS_ZUMBI = 45;
const INTERVALO_PROGRESSO_MS = 500;
const FRACAO_ORCAMENTO_PARCIAL = 0.98;
const LOTE_INSERT = 500;

const MSG_FALHA_GENERICA = 'Falha ao processar. Tente novamente.';
const MSG_SEM_CARDS = 'Não foi possível gerar cards a partir deste material.';
const MSG_ZUMBI = 'O processamento excedeu o tempo limite. Tente novamente.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const statusFinal = sql`${jobs.status} IN (${sql.join(
  JOB_STATUS_FINAIS.map((s) => sql`${s}`),
  sql`, `,
)})`;

type Emitir = (evento: {
  status: JobStatus;
  estagio: Estagio | null;
  percentual: number;
  cardsGerados: number;
  mensagem?: string;
}) => Promise<void>;

interface ResultadoGeracaoJob {
  /** `false` quando nenhum card foi gerado (o job já foi marcado como `falhou`). */
  ok: boolean;
  parcialPorOrcamento: boolean;
}

function lotes<T>(itens: T[]): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE_INSERT) resultado.push(itens.slice(i, i + LOTE_INSERT));
  return resultado;
}

@Injectable()
export class PipelineService {
  private readonly log = new Logger(PipelineService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: StorageService,
    @Inject(PUBLICADOR) private readonly publicador: ProgressoPublisher,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
  ) {}

  /**
   * Idempotente e com checkpoint em `jobs.estagio_concluido` (RFC §2): uma nova execução retoma do estágio
   * seguinte ao último concluído. Lança para a fila tentar de novo; falhas definitivas retornam normalmente.
   */
  async executar(jobId: string): Promise<void> {
    if (!UUID.test(jobId)) {
      this.log.warn(`payload com jobId inválido ignorado: ${jobId}`);
      return;
    }
    const iniciado = await this.iniciarTentativa(jobId);
    if (!iniciado) {
      this.log.log(`job ${jobId} inexistente ou já finalizado; nada a fazer`);
      return;
    }

    let job = iniciado;
    const emitir = this.criarEmissor(job);
    try {
      if (job.estagioConcluido === null) {
        await this.ingerir(job, emitir);
        job = await this.recarregar(jobId);
      }

      // Se a geração é pulada (retry), a decisão "parcial" vem de `decidirParcialPorCusto`.
      let parcialPorOrcamento: boolean | undefined;
      if (job.estagioConcluido === 'ingestao') {
        const geracao = await this.gerar(job, emitir);
        if (!geracao.ok) return;
        parcialPorOrcamento = geracao.parcialPorOrcamento;
        job = await this.recarregar(jobId);
      }

      if (job.estagioConcluido === 'geracao') {
        await this.finalizar(job, parcialPorOrcamento ?? this.decidirParcialPorCusto(job), emitir);
      }
    } catch (erro) {
      await this.tratarErro(job, erro, emitir);
    }
  }

  /** Marca como `falhou` os jobs não finais criados há mais de 45 min e libera a reserva de cota. */
  async varrerZumbis(agora: Date = new Date()): Promise<number> {
    const limite = new Date(agora.getTime() - MINUTOS_ZUMBI * 60_000);
    const candidatos = await this.db
      .select()
      .from(jobs)
      .where(and(sql`NOT (${statusFinal})`, sql`${jobs.createdAt} < ${limite}`));

    let varridos = 0;
    for (const candidato of candidatos) {
      try {
        await liberarReserva(this.db, candidato.id);
        const [marcado] = await this.db
          .update(jobs)
          .set({ status: 'falhou', erro: MSG_ZUMBI, finishedAt: agora })
          .where(and(eq(jobs.id, candidato.id), sql`NOT (${statusFinal})`))
          .returning();
        if (!marcado) continue;
        varridos++;
        this.log.warn(`job ${candidato.id} marcado como falhou pela varredura de zumbis`);
        await this.criarEmissor(marcado)({
          status: 'falhou',
          estagio: this.estagioAtual(marcado),
          percentual: 100,
          cardsGerados: marcado.cardsGerados,
          mensagem: MSG_ZUMBI,
        });
      } catch (erro) {
        this.log.error(`varredura de zumbis falhou para o job ${candidato.id}: ${String(erro)}`);
      }
    }
    return varridos;
  }

  private async iniciarTentativa(jobId: string): Promise<JobRow | undefined> {
    const [job] = await this.db
      .update(jobs)
      .set({
        tentativas: sql`${jobs.tentativas} + 1`,
        startedAt: sql`COALESCE(${jobs.startedAt}, now())`,
      })
      .where(and(eq(jobs.id, jobId), sql`NOT (${statusFinal})`))
      .returning();
    return job;
  }

  private async recarregar(jobId: string): Promise<JobRow> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new Error(`job ${jobId} desapareceu durante o processamento`);
    return job;
  }

  private estagioAtual(job: Pick<JobRow, 'estagioConcluido'>): Estagio {
    if (job.estagioConcluido === null) return 'ingestao';
    return job.estagioConcluido === 'ingestao' ? 'geracao' : 'empacotamento';
  }

  /** Publicações de um job saem em série (ordem preservada) e uma falha nunca derruba o pipeline. */
  private criarEmissor(job: Pick<JobRow, 'id'>): Emitir {
    let cadeia: Promise<void> = Promise.resolve();
    return (evento) => {
      cadeia = cadeia.then(async () => {
        try {
          await this.publicador.publicar({ jobId: job.id, ...evento });
        } catch (erro) {
          this.log.warn(`falha ao publicar progresso do job ${job.id}: ${String(erro)}`);
        }
      });
      return cadeia;
    };
  }

  private async ingerir(job: JobRow, emitir: Emitir): Promise<void> {
    this.log.log(`job ${job.id}: ingestão iniciada (tentativa ${job.tentativas})`);
    await this.db.update(jobs).set({ status: 'ingerindo' }).where(eq(jobs.id, job.id));
    await emitir({ status: 'ingerindo', estagio: 'ingestao', percentual: 5, cardsGerados: 0 });

    const [documento] = await this.db.select().from(documents).where(eq(documents.id, job.documentId));
    if (!documento) throw new Error(`documento ${job.documentId} não encontrado`);

    const dados = await this.storage.ler(documento.storageKey);
    let resultado: ResultadoIngestao;
    if (documento.tipo === 'pdf') {
      const limites = job.anonSessionId
        ? { maxBytes: LIMITES_ANONIMO.maxBytes, maxPaginas: LIMITES_ANONIMO.maxPaginas }
        : { maxBytes: LIMITES_DOCUMENTO.maxBytes, maxPaginas: LIMITES_DOCUMENTO.maxPaginas };
      resultado = await ingerirPdfIsolado(dados, { ...limites, timeoutMs: LIMITES_DOCUMENTO.timeoutParsingMs });
    } else {
      resultado = ingerirTexto(dados.toString('utf8'), LIMITES_DOCUMENTO.maxCaracteresTexto);
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(chunks).where(eq(chunks.jobId, job.id));
      for (const lote of lotes(resultado.chunks)) {
        await tx.insert(chunks).values(
          lote.map((c) => ({
            jobId: job.id,
            ordem: c.ordem,
            trilhaTitulos: c.trilhaTitulos,
            texto: c.texto,
            tokens: c.tokens,
          })),
        );
      }
      await tx
        .update(documents)
        .set({ paginas: resultado.paginas, status: 'processado' })
        .where(eq(documents.id, documento.id));
      await tx.update(jobs).set({ estagioConcluido: 'ingestao' }).where(eq(jobs.id, job.id));
    });

    this.log.log(`job ${job.id}: ingestão concluída (${resultado.chunks.length} chunks)`);
    await emitir({ status: 'gerando', estagio: 'ingestao', percentual: 10, cardsGerados: 0 });
  }

  private async gerar(job: JobRow, emitir: Emitir): Promise<ResultadoGeracaoJob> {
    this.log.log(`job ${job.id}: geração iniciada`);
    await this.db.update(jobs).set({ status: 'gerando' }).where(eq(jobs.id, job.id));

    const linhas: ChunkRow[] = await this.db
      .select()
      .from(chunks)
      .where(eq(chunks.jobId, job.id))
      .orderBy(asc(chunks.ordem));
    const trilhaPorChunk = new Map(linhas.map((c) => [c.id, c.trilhaTitulos]));

    // O ledger acumula o gasto de tentativas anteriores que falharam antes do checkpoint.
    const [{ gasto }] = await this.db
      .select({ gasto: sql<number>`COALESCE(SUM(${llmCalls.custoCentavos}), 0)::float8` })
      .from(llmCalls)
      .where(eq(llmCalls.jobId, job.id));
    const orcamento = new OrcamentoJob(job.orcamentoCentavos, Math.max(job.custoCentavos, gasto));
    const cliente = new LlmClienteRegistrado(this.provider, new LedgerLlmDb(this.db, { anonimo: !!job.anonSessionId }), {
      usdBrl: this.env.USD_BRL,
      modeloPorTier: modeloPorTier(this.env),
    });

    let ultimaPublicacao = 0;
    const resultado = await gerarCards(
      cliente,
      {
        jobId: job.id,
        chunks: linhas.map((c) => ({
          id: c.id,
          ordem: c.ordem,
          trilhaTitulos: c.trilhaTitulos,
          texto: c.texto,
          tokens: c.tokens,
        })),
        parametros: job.params,
        orcamento,
        limiteCards: job.cardsReservados,
      },
      async (feitos, total, cardsAteAgora) => {
        const agora = Date.now();
        if (feitos < total && agora - ultimaPublicacao < INTERVALO_PROGRESSO_MS) return;
        ultimaPublicacao = agora;
        await emitir({
          status: 'gerando',
          estagio: 'geracao',
          percentual: Math.round(10 + (85 * feitos) / Math.max(total, 1)),
          cardsGerados: cardsAteAgora,
        });
      },
    );

    if (resultado.cards.length === 0) {
      await this.db.update(jobs).set({ custoCentavos: orcamento.gastoCentavos }).where(eq(jobs.id, job.id));
      await this.falharDefinitivamente(job, MSG_SEM_CARDS, emitir, 'geracao');
      return { ok: false, parcialPorOrcamento: false };
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(cards).where(and(eq(cards.jobId, job.id), eq(cards.estado, 'gerado')));
      const novos = resultado.cards.map((c, ordem) => ({
        jobId: job.id,
        chunkId: c.chunkId,
        tipo: c.tipo,
        frente: c.frente,
        verso: c.verso,
        textoCloze: c.textoCloze,
        tags: [] as string[],
        trilhaTitulos: trilhaPorChunk.get(c.chunkId) ?? [],
        fonteOffset: c.fonteOffset,
        ordem,
      }));
      for (const lote of lotes(novos)) await tx.insert(cards).values(lote);
      await tx
        .update(jobs)
        .set({
          custoCentavos: orcamento.gastoCentavos,
          cardsGerados: resultado.cards.length,
          estagioConcluido: 'geracao',
        })
        .where(eq(jobs.id, job.id));
    });

    this.log.log(
      `job ${job.id}: geração concluída (${resultado.cards.length} cards, motivo parcial: ${resultado.motivoParcial ?? 'nenhum'})`,
    );
    await emitir({ status: 'gerando', estagio: 'geracao', percentual: 95, cardsGerados: resultado.cards.length });
    return { ok: true, parcialPorOrcamento: resultado.motivoParcial === 'orcamento' };
  }

  /**
   * Não há coluna para lembrar que a geração parou por orçamento. Quando o retry pula a geração, o
   * gasto registrado perto do teto é o sinal: gasto >= 98% do orçamento => parcial.
   */
  private decidirParcialPorCusto(job: JobRow): boolean {
    return job.custoCentavos >= job.orcamentoCentavos * FRACAO_ORCAMENTO_PARCIAL;
  }

  private async finalizar(job: JobRow, parcial: boolean, emitir: Emitir): Promise<void> {
    if (job.userId) await confirmarCota(this.db, job.id, job.cardsGerados);
    const status: JobStatus = parcial ? 'parcial' : 'concluido';
    await this.db
      .update(jobs)
      .set({ status, finishedAt: new Date(), estagioConcluido: 'empacotamento' })
      .where(eq(jobs.id, job.id));
    this.log.log(`job ${job.id}: finalizado como ${status} (${job.cardsGerados} cards)`);
    await emitir({ status, estagio: 'empacotamento', percentual: 100, cardsGerados: job.cardsGerados });
  }

  private async tratarErro(job: JobRow, erro: unknown, emitir: Emitir): Promise<void> {
    if (erro instanceof DocumentoInvalidoError) {
      this.log.warn(`job ${job.id}: documento inválido (${erro.motivo})`);
      await this.db.update(documents).set({ status: 'invalido' }).where(eq(documents.id, job.documentId));
      await this.falharDefinitivamente(job, erro.message, emitir, 'ingestao');
      return;
    }

    const nome = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
    this.log.error(`job ${job.id}: erro inesperado na tentativa ${job.tentativas}/${MAX_TENTATIVAS}: ${nome}`);
    if (job.tentativas >= MAX_TENTATIVAS) {
      await this.falharDefinitivamente(job, MSG_FALHA_GENERICA, emitir);
      return;
    }
    throw erro;
  }

  private async falharDefinitivamente(job: JobRow, mensagem: string, emitir: Emitir, estagio?: Estagio): Promise<void> {
    const atual = await this.recarregar(job.id);
    await liberarReserva(this.db, job.id);
    await this.db
      .update(jobs)
      .set({ status: 'falhou', erro: mensagem, finishedAt: new Date() })
      .where(eq(jobs.id, job.id));
    this.log.warn(`job ${job.id}: falhou definitivamente`);
    await emitir({
      status: 'falhou',
      estagio: estagio ?? this.estagioAtual(atual),
      percentual: 100,
      cardsGerados: atual.cardsGerados,
      mensagem,
    });
  }
}
