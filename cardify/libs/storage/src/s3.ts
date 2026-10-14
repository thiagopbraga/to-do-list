import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { URL_ASSINADA_TTL_SEGUNDOS, type StorageService, type UploadAssinado } from '@cardify/shared';

export interface ConfigS3 {
  endpoint?: string;
  /** Host usado nas URLs assinadas entregues ao navegador, quando difere do `endpoint` da API. */
  endpointPublico?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/** T13 — S3/MinIO com URLs assinadas (RFC §3.1, §11). */
export class S3StorageService implements StorageService {
  private readonly cliente: S3Client;
  private readonly clientePublico: S3Client;

  constructor(readonly config: ConfigS3) {
    const base = {
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: config.forcePathStyle,
    };
    this.cliente = new S3Client({ ...base, endpoint: config.endpoint });
    this.clientePublico = config.endpointPublico
      ? new S3Client({ ...base, endpoint: config.endpointPublico })
      : this.cliente;
  }

  async urlUpload(
    chave: string,
    opcoes: { contentType: string; maxBytes: number; ttlSegundos?: number },
  ): Promise<UploadAssinado> {
    const { url, fields } = await createPresignedPost(this.clientePublico, {
      Bucket: this.config.bucket,
      Key: chave,
      Conditions: [
        ['content-length-range', 1, opcoes.maxBytes],
        ['eq', '$Content-Type', opcoes.contentType],
      ],
      Fields: { 'Content-Type': opcoes.contentType },
      Expires: opcoes.ttlSegundos ?? URL_ASSINADA_TTL_SEGUNDOS,
    });
    return { url, campos: fields };
  }

  async urlDownload(chave: string, opcoes?: { ttlSegundos?: number; nomeArquivo?: string }): Promise<string> {
    const nome = opcoes?.nomeArquivo;
    return getSignedUrl(
      this.clientePublico,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: chave,
        ResponseContentDisposition: nome ? montarContentDisposition(nome) : undefined,
      }),
      { expiresIn: opcoes?.ttlSegundos ?? URL_ASSINADA_TTL_SEGUNDOS },
    );
  }

  async ler(chave: string): Promise<Buffer> {
    const resposta = await this.cliente.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: chave }));
    if (!resposta.Body) throw new Error(`objeto sem corpo: ${chave}`);
    return Buffer.from(await resposta.Body.transformToByteArray());
  }

  async gravar(chave: string, corpo: Buffer | Uint8Array | string, contentType: string): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: chave,
        Body: typeof corpo === 'string' ? Buffer.from(corpo, 'utf8') : corpo,
        ContentType: contentType,
      }),
    );
  }

  async apagar(chave: string): Promise<void> {
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: chave }));
  }

  async metadados(chave: string): Promise<{ bytes: number; contentType?: string } | null> {
    try {
      const resposta = await this.cliente.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: chave }));
      return { bytes: resposta.ContentLength ?? 0, contentType: resposta.ContentType };
    } catch (erro) {
      if (ehNaoEncontrado(erro)) return null;
      throw erro;
    }
  }
}

function ehNaoEncontrado(erro: unknown): boolean {
  const e = erro as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

/** `attachment` com nome ASCII seguro no `filename` e nome UTF-8 completo (RFC 6266 / RFC 5987). */
function montarContentDisposition(nome: string): string {
  const ascii = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]|["\\;]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(nome)}`;
}

function encodeRfc5987(texto: string): string {
  return encodeURIComponent(texto).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
