import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { type Db, and, anonSessions, asc, documents, eq, exportacoes, inArray, isNull, jobs, sql } from '@cardify/db';
import type { Env, StorageService } from '@cardify/shared';
import { DB, ENV, STORAGE } from '../tokens';

export const INTERVALO_RETENCAO_MS = 60 * 60 * 1000;
export const JANELA_PADRAO_DIAS = 2;
const CARENCIA_SESSAO_ANONIMA_DIAS = 7;
const LOTE_DOCUMENTOS = 200;
const LOTE_SESSOES = 100;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface OpcoesRetencao {
  janelaDias?: number;
}

export interface ResumoRetencao {
  objetosRemovidos: number;
  sessoesRemovidas: number;
  falhas: number;
}

interface Cursor {
  expiraEm: Date;
  id: string;
}

/**
 * Retenção do RFC §11: apaga objetos do storage quando o documento ou a exportação expira e remove sessões
 * anônimas abandonadas (com seus documentos, jobs e cards pela cascata). Linhas de documento e cards são preservadas.
 */
@Injectable()
export class RetencaoService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(RetencaoService.name);
  private intervalo: NodeJS.Timeout | undefined;
  private emAndamento = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: StorageService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.NODE_ENV === 'test') return;
    this.intervalo = setInterval(() => void this.executarAgendado(), INTERVALO_RETENCAO_MS);
    this.intervalo.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.intervalo);
  }

  /**
   * `janelaDias` limita documentos e exportações a `expires_at` nos últimos N dias, para não varrer o histórico
   * a cada hora. Um worker parado por mais de `janelaDias` deixa objetos sem apagar: quem o religar deve chamar
   * `executar(agora, { janelaDias })` com uma janela maior. Sessões anônimas não usam janela.
   */
  async executar(agora: Date = new Date(), opcoes: OpcoesRetencao = {}): Promise<ResumoRetencao> {
    const janelaDias = opcoes.janelaDias ?? JANELA_PADRAO_DIAS;
    const resumo: ResumoRetencao = { objetosRemovidos: 0, sessoesRemovidas: 0, falhas: 0 };

    await this.apagarDocumentosExpirados(agora, janelaDias, resumo);
    await this.apagarExportacoesExpiradas(agora, janelaDias, resumo);
    await this.apagarSessoesAnonimasAbandonadas(agora, resumo);

    this.log.log(
      `retenção: ${resumo.objetosRemovidos} objetos e ${resumo.sessoesRemovidas} sessões anônimas removidos, ${resumo.falhas} falhas`,
    );
    return resumo;
  }

  private async executarAgendado(): Promise<void> {
    if (this.emAndamento) return;
    this.emAndamento = true;
    try {
      await this.executar();
    } catch (erro) {
      this.log.error(`execução de retenção falhou: ${String(erro)}`);
    } finally {
      this.emAndamento = false;
    }
  }

  private async apagarDocumentosExpirados(agora: Date, janelaDias: number, resumo: ResumoRetencao): Promise<void> {
    const inicio = new Date(agora.getTime() - janelaDias * DIA_MS);
    let cursor: Cursor | undefined;
    for (;;) {
      const lote = await this.db
        .select({
          id: documents.id,
          expiraEm: documents.expiresAt,
          storageKey: documents.storageKey,
          textoExtraidoKey: documents.textoExtraidoKey,
        })
        .from(documents)
        .where(
          and(
            sql`(${documents.expiresAt} >= ${inicio} AND ${documents.expiresAt} < ${agora})`,
            cursor ? sql`(${documents.expiresAt}, ${documents.id}) > (${cursor.expiraEm}, ${cursor.id})` : undefined,
          ),
        )
        .orderBy(asc(documents.expiresAt), asc(documents.id))
        .limit(LOTE_DOCUMENTOS);

      for (const documento of lote) {
        await this.apagarObjetos([documento.storageKey, documento.textoExtraidoKey], resumo);
      }

      const ultimo = lote[lote.length - 1];
      if (!ultimo || lote.length < LOTE_DOCUMENTOS) return;
      cursor = { expiraEm: ultimo.expiraEm, id: ultimo.id };
    }
  }

  private async apagarExportacoesExpiradas(agora: Date, janelaDias: number, resumo: ResumoRetencao): Promise<void> {
    const inicio = new Date(agora.getTime() - janelaDias * DIA_MS);
    let cursor: Cursor | undefined;
    for (;;) {
      const lote = await this.db
        .select({
          id: exportacoes.id,
          expiraEm: sql<Date>`${exportacoes.expiresAt}`,
          storageKey: exportacoes.storageKey,
        })
        .from(exportacoes)
        .where(
          and(
            sql`(${exportacoes.expiresAt} >= ${inicio} AND ${exportacoes.expiresAt} < ${agora} AND ${exportacoes.storageKey} IS NOT NULL)`,
            cursor ? sql`(${exportacoes.expiresAt}, ${exportacoes.id}) > (${cursor.expiraEm}, ${cursor.id})` : undefined,
          ),
        )
        .orderBy(asc(exportacoes.expiresAt), asc(exportacoes.id))
        .limit(LOTE_DOCUMENTOS);

      for (const exportacao of lote) {
        await this.apagarObjetos([exportacao.storageKey], resumo);
      }

      const ultimo = lote[lote.length - 1];
      if (!ultimo || lote.length < LOTE_DOCUMENTOS) return;
      cursor = { expiraEm: ultimo.expiraEm, id: ultimo.id };
    }
  }

  /**
   * Objetos vêm antes da linha: se a sessão sumisse primeiro, a chave do storage se perderia e o objeto
   * ficaria órfão. Sessão com objeto que falhou fica no banco para a próxima execução tentar de novo.
   */
  private async apagarSessoesAnonimasAbandonadas(agora: Date, resumo: ResumoRetencao): Promise<void> {
    const limite = new Date(agora.getTime() - CARENCIA_SESSAO_ANONIMA_DIAS * DIA_MS);
    let cursor: Cursor | undefined;
    for (;;) {
      const lote = await this.db
        .select({ id: anonSessions.id, expiraEm: anonSessions.expiresAt })
        .from(anonSessions)
        .where(
          and(
            isNull(anonSessions.userId),
            sql`${anonSessions.expiresAt} < ${limite}`,
            cursor ? sql`(${anonSessions.expiresAt}, ${anonSessions.id}) > (${cursor.expiraEm}, ${cursor.id})` : undefined,
          ),
        )
        .orderBy(asc(anonSessions.expiresAt), asc(anonSessions.id))
        .limit(LOTE_SESSOES);
      if (lote.length === 0) return;

      const objetosPorSessao = await this.objetosDasSessoes(lote.map((sessao) => sessao.id));
      const prontas: string[] = [];
      for (const sessao of lote) {
        if (await this.apagarObjetos(objetosPorSessao.get(sessao.id) ?? [], resumo)) prontas.push(sessao.id);
      }

      if (prontas.length > 0) {
        const removidas = await this.db
          .delete(anonSessions)
          .where(
            and(
              inArray(anonSessions.id, prontas),
              isNull(anonSessions.userId),
              sql`${anonSessions.expiresAt} < ${limite}`,
            ),
          )
          .returning({ id: anonSessions.id });
        resumo.sessoesRemovidas += removidas.length;
      }

      const ultimo = lote[lote.length - 1];
      if (!ultimo || lote.length < LOTE_SESSOES) return;
      cursor = { expiraEm: ultimo.expiraEm, id: ultimo.id };
    }
  }

  private async objetosDasSessoes(ids: string[]): Promise<Map<string, string[]>> {
    const porSessao = new Map<string, string[]>();
    const adicionar = (sessao: string | null, chave: string | null) => {
      if (!sessao || !chave) return;
      porSessao.set(sessao, [...(porSessao.get(sessao) ?? []), chave]);
    };

    const docs = await this.db
      .select({
        sessao: documents.anonSessionId,
        storageKey: documents.storageKey,
        textoExtraidoKey: documents.textoExtraidoKey,
      })
      .from(documents)
      .where(inArray(documents.anonSessionId, ids));
    for (const doc of docs) {
      adicionar(doc.sessao, doc.storageKey);
      adicionar(doc.sessao, doc.textoExtraidoKey);
    }

    // Exportações somem com a sessão pela cascata; sem apagar o .apkg antes, ele ficaria órfão no storage.
    const exps = await this.db
      .select({ sessao: jobs.anonSessionId, storageKey: exportacoes.storageKey })
      .from(exportacoes)
      .innerJoin(jobs, eq(jobs.id, exportacoes.jobId))
      .where(and(inArray(jobs.anonSessionId, ids), sql`${exportacoes.storageKey} IS NOT NULL`));
    for (const exportacao of exps) adicionar(exportacao.sessao, exportacao.storageKey);

    return porSessao;
  }

  /** Devolve `true` só se todos os objetos da lista foram apagados (ou já não existiam). */
  private async apagarObjetos(chaves: Array<string | null>, resumo: ResumoRetencao): Promise<boolean> {
    let completo = true;
    for (const chave of chaves) {
      if (!chave) continue;
      try {
        if (await this.apagarObjeto(chave)) resumo.objetosRemovidos++;
      } catch (erro) {
        completo = false;
        resumo.falhas++;
        this.log.warn(`objeto do storage não apagado (${nomeErro(erro)}); a próxima execução tenta de novo`);
      }
    }
    return completo;
  }

  /** Só apaga o que existe, para que o contador reflita remoções reais e não as repetições diárias da janela. */
  private async apagarObjeto(chave: string): Promise<boolean> {
    if ((await this.storage.metadados(chave)) === null) return false;
    await this.storage.apagar(chave);
    return true;
  }
}

function nomeErro(erro: unknown): string {
  return erro instanceof Error ? erro.name : 'erro desconhecido';
}
