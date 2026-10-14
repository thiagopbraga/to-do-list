import { naoImplementado, type StorageService, type UploadAssinado } from '@cardify/shared';

export interface ConfigS3 {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/** T13 — S3/MinIO com URLs assinadas (RFC §3.1, §11). */
export class S3StorageService implements StorageService {
  constructor(readonly config: ConfigS3) {}
  async urlUpload(_chave: string, _opcoes: { contentType: string; maxBytes: number; ttlSegundos?: number }): Promise<UploadAssinado> {
    naoImplementado('T13');
  }
  async urlDownload(_chave: string, _opcoes?: { ttlSegundos?: number; nomeArquivo?: string }): Promise<string> {
    naoImplementado('T13');
  }
  async ler(_chave: string): Promise<Buffer> {
    naoImplementado('T13');
  }
  async gravar(_chave: string, _corpo: Buffer | Uint8Array | string, _contentType: string): Promise<void> {
    naoImplementado('T13');
  }
  async apagar(_chave: string): Promise<void> {
    naoImplementado('T13');
  }
  async metadados(_chave: string): Promise<{ bytes: number; contentType?: string } | null> {
    naoImplementado('T13');
  }
}
