import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, type MessageEvent } from '@nestjs/common';
import {
  type Db,
  type DocumentRow,
  type JobRow,
  and,
  consultarCota,
  desc,
  documents,
  eq,
  jobs,
  liberarReserva,
  reservarECriarJob,
} from '@cardify/db';
import {
  chaveStorage,
  type CriarJob,
  CUSTO_MAX_CENTAVOS_POR_100_CARDS,
  donoStorage,
  estimarCards,
  FILAS,
  type FilaService,
  JOB_STATUS_FINAIS,
  type JobResumo,
  LIMITES_ANONIMO,
  type PayloadGerarBaralho,
  type ProgressoEvento,
  type ProgressoSubscriber,
  type StorageService,
} from '@cardify/shared';
import { Observable } from 'rxjs';
import { DB, FILA, PROGRESSO, STORAGE } from '../infra/tokens';
import { type Dono, mesmoDono } from '../sessao/dono';
import { IDEMPOTENCY_KEY_MAX } from './dto';
import {
  conflito,
  jsonCanonico,
  naoEncontrado,
  paraEventoProgresso,
  paraResumo,
  sha256Hex,
  type Tx,
  violacaoUnica,
} from './util';


const ORCAMENTO_MINIMO_CENTAVOS = 15;
const RETENCAO_DOCUMENTO_MS = 7 * 24 * 60 * 60 * 1000;
const LIMITE_LISTAGEM = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JobsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: StorageService,
    @Inject(FILA) private readonly fila: FilaService,
    @Inject(PROGRESSO) private readonly progresso: ProgressoSubscriber,
  ) {}

  async criar(dono: Dono, corpo: CriarJob, chaveCliente?: string): Promise<JobResumo> {
    if (chaveCliente !== undefined && chaveCliente.length > IDEMPOTENCY_KEY_MAX) {
      throw new BadRequestException({
        erro: 'idempotency_key_invalida',
        mensagem: `Idempotency-Key excede ${IDEMPOTENCY_KEY_MAX} caracteres.`,
      });
    }

    const anonimo = !dono.userId;
    const amostra = anonimo || corpo.amostra;
    const donoId = (dono.userId ?? dono.anonSessionId) as string;
    const paramsHash = sha256Hex(jsonCanonico({ parametros: corpo.parametros, amostra }));

    const documento = corpo.documentId ? await this.documentoReutilizavel(dono, corpo.documentId) : null;
    const texto = documento ? null : (corpo.texto as string);
    const sha256Documento = documento ? documento.sha256 : sha256Hex(texto as string);
    const caracteres = documento ? (documento.bytes ?? 0) : (texto as string).length;

    // A chave do cliente é escopada ao dono: o mesmo header de outro usuário nunca devolve o job alheio.
    const chave = chaveCliente ? `${donoId}:${chaveCliente}` : sha256Hex(donoId + sha256Documento + paramsHash);

    const existente = await this.buscarPorChave(chave);
    if (existente) {
      if (existente.status !== 'falhou') return paraResumo(existente);
      await this.db
        .update(jobs)
        .set({ idempotencyKey: null })
        .where(and(eq(jobs.id, existente.id), eq(jobs.idempotencyKey, chave)));
    }

    const nome = corpo.nome ?? documento?.nome ?? 'Texto colado';
    let documentId = documento?.id as string;
    let storageKeyTexto: string | null = null;
    if (texto !== null) {
      documentId = randomUUID();
      storageKeyTexto = chaveStorage.documento(donoStorage(dono), documentId);
      await this.storage.gravar(storageKeyTexto, texto, 'text/plain; charset=utf-8');
    }

    let criado: JobRow | undefined;
    const inserir = async (tx: Tx, reservado: number): Promise<{ id: string }> => {
      if (texto !== null && storageKeyTexto) {
        await tx.insert(documents).values({
          id: documentId,
          userId: dono.userId,
          anonSessionId: dono.userId ? null : dono.anonSessionId,
          tipo: 'texto',
          sha256: sha256Documento,
          nome,
          bytes: Buffer.byteLength(texto),
          storageKey: storageKeyTexto,
          status: 'enviado',
          expiresAt: new Date(Date.now() + RETENCAO_DOCUMENTO_MS),
        });
      }
      const [job] = await tx
        .insert(jobs)
        .values({
          userId: dono.userId,
          anonSessionId: dono.userId ? null : dono.anonSessionId,
          documentId,
          status: 'pendente',
          params: corpo.parametros,
          paramsHash,
          amostra,
          nome,
          orcamentoCentavos: Math.max(
            ORCAMENTO_MINIMO_CENTAVOS,
            (reservado * CUSTO_MAX_CENTAVOS_POR_100_CARDS) / 100,
          ),
          cardsReservados: reservado,
          idempotencyKey: chave,
        })
        .returning();
      criado = job;
      return job;
    };

    try {
      if (dono.userId) {
        const estimativa = Math.min(
          estimarCards({ caracteres, densidade: corpo.parametros.densidade }),
          amostra ? LIMITES_ANONIMO.maxCards : Number.POSITIVE_INFINITY,
        );
        await reservarECriarJob(this.db, { userId: dono.userId, estimativa, criarJob: inserir });
      } else {
        await this.db.transaction((tx) => inserir(tx, LIMITES_ANONIMO.maxCards));
      }
    } catch (erro) {
      if (storageKeyTexto) await this.storage.apagar(storageKeyTexto).catch(() => undefined);
      if (violacaoUnica(erro)) {
        const concorrente = await this.buscarPorChave(chave);
        if (concorrente) return paraResumo(concorrente);
      }
      throw erro;
    }

    const job = criado as JobRow | undefined;
    if (!job) throw new Error('job não criado');
    try {
      const payload: PayloadGerarBaralho = { jobId: job.id };
      await this.fila.enviar(FILAS.gerarBaralho, payload, { singletonKey: chave });
    } catch (erro) {
      await this.db
        .update(jobs)
        .set({ status: 'falhou', erro: 'falha_ao_enfileirar', finishedAt: new Date() })
        .where(eq(jobs.id, job.id));
      await liberarReserva(this.db, job.id);
      throw erro;
    }
    return paraResumo(job);
  }

  async listar(userId: string): Promise<JobResumo[]> {
    const linhas = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(desc(jobs.createdAt))
      .limit(LIMITE_LISTAGEM);
    return linhas.map(paraResumo);
  }

  cota(userId: string) {
    return consultarCota(this.db, userId);
  }

  async obter(dono: Dono, id: string): Promise<JobResumo> {
    return paraResumo(await this.jobDoDono(dono, id));
  }

  /**
   * Estado atual do banco e depois os eventos do worker. Assina ANTES de ler o banco para não perder
   * transições no intervalo; eventos que chegam durante a leitura ficam em buffer.
   */
  async streamProgresso(dono: Dono, id: string): Promise<Observable<MessageEvent>> {
    await this.jobDoDono(dono, id);

    return new Observable<MessageEvent>((assinante) => {
      let encerrado = false;
      let iniciado = false;
      let cancelar: (() => Promise<void>) | null = null;
      const buffer: ProgressoEvento[] = [];

      const emitir = (evento: ProgressoEvento) => {
        if (encerrado) return;
        assinante.next({ data: evento });
        if (JOB_STATUS_FINAIS.includes(evento.status)) assinante.complete();
      };

      void (async () => {
        const cancelamento = await this.progresso.assinar(id, (evento) => {
          if (iniciado) emitir(evento);
          else buffer.push(evento);
        });
        if (encerrado) {
          await cancelamento();
          return;
        }
        cancelar = cancelamento;

        const [job] = await this.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
        if (!job) throw naoEncontrado();
        emitir(paraEventoProgresso(job));
        iniciado = true;
        for (const evento of buffer.splice(0)) emitir(evento);
      })().catch((erro: unknown) => assinante.error(erro));

      return () => {
        encerrado = true;
        const cancelamento = cancelar;
        cancelar = null;
        if (cancelamento) void cancelamento().catch(() => undefined);
      };
    });
  }

  private async buscarPorChave(chave: string): Promise<JobRow | undefined> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.idempotencyKey, chave)).limit(1);
    return job;
  }

  private async documentoReutilizavel(dono: Dono, documentId: string): Promise<DocumentRow> {
    if (!UUID.test(documentId)) throw naoEncontrado();
    const [documento] = await this.db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (!documento || !mesmoDono(dono, documento)) throw naoEncontrado();
    if (documento.status !== 'enviado' && documento.status !== 'processado') {
      throw conflito('documento_nao_enviado', 'O upload deste documento ainda não foi concluído.');
    }
    return documento;
  }

  private async jobDoDono(dono: Dono, id: string): Promise<JobRow> {
    if (!UUID.test(id)) throw naoEncontrado();
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job || !mesmoDono(dono, job)) throw naoEncontrado();
    return job;
  }
}
