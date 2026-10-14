import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type Db, documents, eq } from '@cardify/db';
import { detectarTipo } from '@cardify/ingest';
import {
  chaveStorage,
  DocumentoInvalidoError,
  donoStorage,
  LIMITES_ANONIMO,
  LIMITES_DOCUMENTO,
  type StorageService,
  type UploadAssinado,
} from '@cardify/shared';
import { DB, STORAGE } from '../infra/tokens';
import { type Dono, mesmoDono } from '../sessao/dono';
import type { CriarUpload } from './dto';
import { conflito, naoEncontrado, sha256Hex } from './util';

/** RFC §11: o PDF original é apagado em 7 dias. */
const RETENCAO_DOCUMENTO_MS = 7 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function maxBytesDoDono(dono: Dono): number {
  return dono.userId ? LIMITES_DOCUMENTO.maxBytes : LIMITES_ANONIMO.maxBytes;
}

@Injectable()
export class UploadsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: StorageService,
  ) {}

  async criar(dono: Dono, corpo: CriarUpload): Promise<{ documentId: string; upload: UploadAssinado }> {
    const maxBytes = maxBytesDoDono(dono);
    if (corpo.bytes > maxBytes) {
      throw new DocumentoInvalidoError(
        'muito_grande',
        `O arquivo excede o tamanho máximo de ${Math.round((maxBytes / (1024 * 1024)) * 10) / 10} MB.`,
      );
    }

    const documentId = randomUUID();
    const storageKey = chaveStorage.documento(donoStorage(dono), documentId);
    const upload = await this.storage.urlUpload(storageKey, { contentType: corpo.contentType, maxBytes });
    await this.db.insert(documents).values({
      id: documentId,
      userId: dono.userId,
      anonSessionId: dono.userId ? null : dono.anonSessionId,
      tipo: 'pdf',
      sha256: '',
      nome: corpo.nome,
      storageKey,
      status: 'aguardando_upload',
      expiresAt: new Date(Date.now() + RETENCAO_DOCUMENTO_MS),
    });
    return { documentId, upload };
  }

  async concluir(dono: Dono, documentId: string): Promise<{ documentId: string; sha256: string; bytes: number }> {
    if (!UUID.test(documentId)) throw naoEncontrado();
    const [documento] = await this.db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (!documento || !mesmoDono(dono, documento)) throw naoEncontrado();

    if (documento.status === 'enviado' || documento.status === 'processado') {
      return { documentId, sha256: documento.sha256, bytes: documento.bytes ?? 0 };
    }
    if (documento.status === 'invalido') throw conflito('documento_invalido', 'Este upload foi rejeitado.');

    const meta = await this.storage.metadados(documento.storageKey);
    if (!meta) throw conflito('upload_pendente', 'O arquivo ainda não foi enviado ao armazenamento.');

    const rejeitar = async (erro: DocumentoInvalidoError): Promise<never> => {
      await this.storage.apagar(documento.storageKey);
      await this.db.update(documents).set({ status: 'invalido' }).where(eq(documents.id, documentId));
      throw erro;
    };

    if (meta.bytes > maxBytesDoDono(dono)) {
      return rejeitar(new DocumentoInvalidoError('muito_grande', 'O arquivo enviado excede o tamanho máximo.'));
    }
    const dados = await this.storage.ler(documento.storageKey);
    if ((await detectarTipo(dados)) !== 'pdf') {
      return rejeitar(new DocumentoInvalidoError('tipo_invalido', 'O arquivo enviado não é um PDF válido.'));
    }

    const sha256 = sha256Hex(dados);
    await this.db
      .update(documents)
      .set({ sha256, bytes: dados.length, status: 'enviado' })
      .where(eq(documents.id, documentId));
    return { documentId, sha256, bytes: dados.length };
  }
}
