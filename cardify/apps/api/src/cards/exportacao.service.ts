import { randomUUID } from 'node:crypto';
import { ConflictException, GoneException, Inject, Injectable } from '@nestjs/common';
import {
  type CardRow,
  type Db,
  type JobRow,
  and,
  asc,
  cards,
  documents,
  eq,
  exportacoes,
  jobs,
  sql,
} from '@cardify/db';
import { AnkiApkgPacker, exportarDelimitado } from '@cardify/apkg';
import {
  type CriarExport,
  type ExportFormato,
  type PacoteBaralho,
  type StorageService,
  URL_ASSINADA_TTL_SEGUNDOS,
  chaveStorage,
  donoStorage,
  slugify,
} from '@cardify/shared';
import { DB, STORAGE } from '../infra/tokens';
import { mesmoDono, type Dono } from '../sessao/dono';
import { ehUuid, jobDoDono, naoEncontrado } from './acesso';
import { nomeDoBaralho, paraNotaExportavel } from './mapeamento';

const STATUS_EXPORTAVEIS: JobRow['status'][] = ['concluido', 'parcial'];
const DIAS_DE_VALIDADE = 30;

const EXTENSAO: Record<ExportFormato, string> = { apkg: 'apkg', csv: 'csv', tsv: 'tsv' };
const CONTENT_TYPE: Record<ExportFormato, string> = {
  apkg: 'application/octet-stream',
  csv: 'text/csv; charset=utf-8',
  tsv: 'text/tab-separated-values; charset=utf-8',
};

@Injectable()
export class ExportacaoService {
  private readonly apkg = new AnkiApkgPacker();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: StorageService,
  ) {}

  async criar(corpo: CriarExport, dono: Dono): Promise<{ id: string; formato: ExportFormato; bytes: number }> {
    const job = await jobDoDono(this.db, corpo.jobId, dono);
    if (!STATUS_EXPORTAVEIS.includes(job.status)) throw new ConflictException({ erro: 'job_nao_finalizado' });

    const nomeBaralho = nomeDoBaralho(await this.nomeDoDocumento(job.documentId));
    const linhas: CardRow[] = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.jobId, job.id), sql`${cards.estado} <> 'descartado'`))
      .orderBy(asc(cards.ordem), asc(cards.id));
    if (linhas.length === 0) throw new ConflictException({ erro: 'sem_cards' });

    const pacote: PacoteBaralho = {
      nomeBaralho,
      slugDocumento: slugify(nomeBaralho),
      notas: linhas.map(paraNotaExportavel),
    };
    const conteudo = await this.gerar(corpo.formato, pacote);

    const id = randomUUID();
    const chave = chaveStorage.exportacao(donoStorage(job), id, EXTENSAO[corpo.formato]);
    await this.storage.gravar(chave, conteudo, CONTENT_TYPE[corpo.formato]);
    await this.db.insert(exportacoes).values({
      id,
      jobId: job.id,
      formato: corpo.formato,
      status: 'pronto',
      storageKey: chave,
      bytes: conteudo.length,
      expiresAt: new Date(Date.now() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000),
    });
    return { id, formato: corpo.formato, bytes: conteudo.length };
  }

  async urlDownload(exportId: string, dono: Dono): Promise<string> {
    if (!ehUuid(exportId)) throw naoEncontrado();
    const [linha] = await this.db
      .select({ exportacao: exportacoes, job: jobs })
      .from(exportacoes)
      .innerJoin(jobs, eq(jobs.id, exportacoes.jobId))
      .where(eq(exportacoes.id, exportId));
    if (!linha || !mesmoDono(dono, linha.job)) throw naoEncontrado();

    const { exportacao, job } = linha;
    if (exportacao.status !== 'pronto' || !exportacao.storageKey) {
      throw new ConflictException({ erro: 'export_nao_pronto' });
    }
    if (exportacao.expiresAt && exportacao.expiresAt.getTime() <= Date.now()) {
      throw new GoneException({ erro: 'expirado' });
    }

    const nomeBaralho = nomeDoBaralho(await this.nomeDoDocumento(job.documentId));
    return this.storage.urlDownload(exportacao.storageKey, {
      ttlSegundos: URL_ASSINADA_TTL_SEGUNDOS,
      nomeArquivo: `${nomeBaralho}.${EXTENSAO[exportacao.formato]}`,
    });
  }

  private gerar(formato: ExportFormato, pacote: PacoteBaralho): Promise<Buffer> {
    switch (formato) {
      case 'apkg':
        return this.apkg.empacotar(pacote);
      case 'csv':
        return Promise.resolve(Buffer.from(exportarDelimitado(pacote, ','), 'utf8'));
      case 'tsv':
        return Promise.resolve(Buffer.from(exportarDelimitado(pacote, '\t'), 'utf8'));
    }
  }

  private async nomeDoDocumento(documentId: string): Promise<string | null> {
    const [documento] = await this.db
      .select({ nome: documents.nome })
      .from(documents)
      .where(eq(documents.id, documentId));
    return documento?.nome ?? null;
  }
}
