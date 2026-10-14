import { randomUUID } from 'node:crypto';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { URL_ASSINADA_TTL_SEGUNDOS } from '@cardify/shared';
import { S3StorageService } from './s3';

const ENDPOINT = process.env.S3_ENDPOINT_TEST ?? 'http://localhost:9100';
const BUCKET = 'cardify-teste';
const REGIAO = 'us-east-1';
const CREDENCIAIS = { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' };
const CONFIG = { endpoint: ENDPOINT, region: REGIAO, bucket: BUCKET, forcePathStyle: true, ...CREDENCIAIS };

async function postarArquivo(
  url: string,
  campos: Record<string, string>,
  corpo: Buffer,
  contentTypeArquivo: string,
  contentTypeCampo?: string,
): Promise<Response> {
  const form = new FormData();
  for (const [nome, valor] of Object.entries(campos)) form.append(nome, valor);
  if (contentTypeCampo !== undefined) form.set('Content-Type', contentTypeCampo);
  form.append('file', new Blob([corpo], { type: contentTypeArquivo }), 'arquivo');
  return fetch(url, { method: 'POST', body: form });
}

describe('S3StorageService contra MinIO', () => {
  let storage: S3StorageService;

  beforeAll(async () => {
    storage = new S3StorageService(CONFIG);
    const cliente = new S3Client({ endpoint: ENDPOINT, region: REGIAO, credentials: CREDENCIAIS, forcePathStyle: true });
    try {
      await cliente.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch (erro) {
      const nome = (erro as { name?: string }).name;
      if (nome !== 'BucketAlreadyOwnedByYou' && nome !== 'BucketAlreadyExists') {
        const motivo = erro instanceof Error ? erro.message : String(erro);
        throw new Error(
          `MinIO de teste inacessível em ${ENDPOINT} (${motivo}). Suba com: docker run -d --rm --name cardify-minio-t13 -p 9100:9000 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data`,
        );
      }
    } finally {
      cliente.destroy();
    }
  });

  it('gravar, ler, metadados e apagar', async () => {
    const chave = `crud/${randomUUID()}.txt`;
    await storage.gravar(chave, 'conteúdo', 'text/plain');

    expect((await storage.ler(chave)).toString('utf8')).toBe('conteúdo');
    expect(await storage.metadados(chave)).toEqual({ bytes: Buffer.byteLength('conteúdo'), contentType: 'text/plain' });

    await storage.apagar(chave);
    expect(await storage.metadados(chave)).toBeNull();
  });

  it('gravar aceita Buffer binário sem alterar os bytes', async () => {
    const chave = `crud/${randomUUID()}.bin`;
    const bytes = Buffer.from([0, 1, 2, 127, 128, 255]);
    await storage.gravar(chave, bytes, 'application/octet-stream');

    expect((await storage.ler(chave)).equals(bytes)).toBe(true);
  });

  it('apagar é idempotente e metadados de chave inexistente é null', async () => {
    const chave = `crud/${randomUUID()}`;
    await expect(storage.apagar(chave)).resolves.toBeUndefined();
    expect(await storage.metadados(chave)).toBeNull();
  });

  it('urlDownload baixa com fetch e traz Content-Disposition com nome ASCII e UTF-8', async () => {
    const chave = `download/${randomUUID()}.apkg`;
    const bytes = Buffer.from([0, 10, 13, 250]);
    await storage.gravar(chave, bytes, 'application/octet-stream');

    const url = await storage.urlDownload(chave, { nomeArquivo: 'Relatório "final".apkg' });
    const resposta = await fetch(url);

    expect(resposta.status).toBe(200);
    expect(Buffer.from(await resposta.arrayBuffer()).equals(bytes)).toBe(true);
    expect(resposta.headers.get('content-disposition')).toBe(
      `attachment; filename="Relatorio _final_.apkg"; filename*=UTF-8''Relat%C3%B3rio%20%22final%22.apkg`,
    );
  });

  it('urlDownload sem nomeArquivo não força Content-Disposition e usa TTL padrão de 15 min', async () => {
    const chave = `download/${randomUUID()}.txt`;
    await storage.gravar(chave, 'x', 'text/plain');

    const url = await storage.urlDownload(chave);
    const resposta = await fetch(url);

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-disposition')).toBeNull();
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe(String(URL_ASSINADA_TTL_SEGUNDOS));
  });

  it('urlDownload respeita ttlSegundos informado', async () => {
    const url = await storage.urlDownload('qualquer', { ttlSegundos: 60 });
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('60');
  });

  it('urlUpload aceita arquivo dentro do limite via fetch + FormData', async () => {
    const chave = `uploads/${randomUUID()}.txt`;
    const { url, campos } = await storage.urlUpload(chave, { contentType: 'text/plain', maxBytes: 1024 });

    const resposta = await postarArquivo(url, campos, Buffer.from('x'.repeat(100)), 'text/plain');

    expect([201, 204]).toContain(resposta.status);
    expect(await storage.metadados(chave)).toEqual({ bytes: 100, contentType: 'text/plain' });
  });

  it('urlUpload rejeita arquivo acima de maxBytes', async () => {
    const chave = `uploads/${randomUUID()}.txt`;
    const { url, campos } = await storage.urlUpload(chave, { contentType: 'text/plain', maxBytes: 1000 });

    const resposta = await postarArquivo(url, campos, Buffer.from('x'.repeat(2000)), 'text/plain');

    expect(resposta.status).toBeGreaterThanOrEqual(400);
    expect(resposta.status).toBeLessThan(500);
    expect(await storage.metadados(chave)).toBeNull();
  });

  it('urlUpload rejeita Content-Type diferente do assinado', async () => {
    const chave = `uploads/${randomUUID()}.txt`;
    const { url, campos } = await storage.urlUpload(chave, { contentType: 'text/plain', maxBytes: 1024 });

    const resposta = await postarArquivo(url, campos, Buffer.from('oi'), 'text/html', 'text/html');

    expect(resposta.status).toBeGreaterThanOrEqual(400);
    expect(resposta.status).toBeLessThan(500);
    expect(await storage.metadados(chave)).toBeNull();
  });

  it('endpointPublico gera URL assinada no host público', async () => {
    const chave = `download/${randomUUID()}.txt`;
    await storage.gravar(chave, 'publico', 'text/plain');
    const comPublico = new S3StorageService({ ...CONFIG, endpoint: 'http://127.0.0.1:1', endpointPublico: ENDPOINT });

    const url = await comPublico.urlDownload(chave);
    const resposta = await fetch(url);

    expect(url.startsWith(`${ENDPOINT}/`)).toBe(true);
    expect(await resposta.text()).toBe('publico');
  });
});
