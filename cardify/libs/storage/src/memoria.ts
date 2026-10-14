import type { StorageService, UploadAssinado } from '@cardify/shared';

interface ObjetoMemoria {
  corpo: Buffer;
  contentType: string;
}

/** Storage em memória para testes de outras tasks. URLs assinadas são fictícias. */
export class MemoriaStorageService implements StorageService {
  private readonly objetos = new Map<string, ObjetoMemoria>();

  async urlUpload(chave: string, _opcoes: { contentType: string; maxBytes: number; ttlSegundos?: number }): Promise<UploadAssinado> {
    return { url: `memoria://upload/${chave}`, campos: { key: chave } };
  }

  async urlDownload(chave: string, _opcoes?: { ttlSegundos?: number; nomeArquivo?: string }): Promise<string> {
    return `memoria://download/${chave}`;
  }

  async ler(chave: string): Promise<Buffer> {
    const objeto = this.objetos.get(chave);
    if (!objeto) throw new Error(`objeto não encontrado: ${chave}`);
    return Buffer.from(objeto.corpo);
  }

  async gravar(chave: string, corpo: Buffer | Uint8Array | string, contentType: string): Promise<void> {
    const copia = typeof corpo === 'string' ? Buffer.from(corpo, 'utf8') : Buffer.from(corpo);
    this.objetos.set(chave, { corpo: copia, contentType });
  }

  async apagar(chave: string): Promise<void> {
    this.objetos.delete(chave);
  }

  async metadados(chave: string): Promise<{ bytes: number; contentType?: string } | null> {
    const objeto = this.objetos.get(chave);
    if (!objeto) return null;
    return { bytes: objeto.corpo.length, contentType: objeto.contentType };
  }
}
