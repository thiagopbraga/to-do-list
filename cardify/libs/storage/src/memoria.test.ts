import { MemoriaStorageService } from './memoria';

describe('MemoriaStorageService', () => {
  let storage: MemoriaStorageService;

  beforeEach(() => {
    storage = new MemoriaStorageService();
  });

  it('grava, lê, consulta metadados e apaga', async () => {
    await storage.gravar('a/b.txt', Buffer.from('olá'), 'text/plain');
    expect((await storage.ler('a/b.txt')).toString('utf8')).toBe('olá');
    expect(await storage.metadados('a/b.txt')).toEqual({ bytes: 4, contentType: 'text/plain' });

    await storage.apagar('a/b.txt');
    expect(await storage.metadados('a/b.txt')).toBeNull();
  });

  it('aceita string e Uint8Array no gravar', async () => {
    await storage.gravar('texto', 'acentuação', 'text/plain');
    await storage.gravar('bytes', new Uint8Array([1, 2, 3]), 'application/octet-stream');

    expect((await storage.ler('texto')).toString('utf8')).toBe('acentuação');
    expect(await storage.metadados('bytes')).toEqual({ bytes: 3, contentType: 'application/octet-stream' });
  });

  it('ler devolve cópia, não a referência interna', async () => {
    await storage.gravar('c', Buffer.from('original'), 'text/plain');
    const lido = await storage.ler('c');
    lido.write('X', 0);

    expect((await storage.ler('c')).toString('utf8')).toBe('original');
  });

  it('gravar sobrescreve o conteúdo anterior', async () => {
    await storage.gravar('c', 'v1', 'text/plain');
    await storage.gravar('c', 'versao2', 'application/json');

    expect((await storage.ler('c')).toString('utf8')).toBe('versao2');
    expect(await storage.metadados('c')).toEqual({ bytes: 7, contentType: 'application/json' });
  });

  it('ler de chave inexistente lança erro', async () => {
    await expect(storage.ler('nao-existe')).rejects.toThrow('nao-existe');
  });

  it('metadados de chave inexistente é null', async () => {
    expect(await storage.metadados('nao-existe')).toBeNull();
  });

  it('apagar é idempotente', async () => {
    await storage.apagar('nao-existe');
    await storage.gravar('c', 'x', 'text/plain');
    await storage.apagar('c');
    await expect(storage.apagar('c')).resolves.toBeUndefined();
  });

  it('urlUpload e urlDownload devolvem URLs fictícias', async () => {
    const upload = await storage.urlUpload('uploads/1.pdf', { contentType: 'application/pdf', maxBytes: 1024 });
    expect(upload).toEqual({ url: 'memoria://upload/uploads/1.pdf', campos: { key: 'uploads/1.pdf' } });
    expect(await storage.urlDownload('exports/1.apkg')).toBe('memoria://download/exports/1.apkg');
  });
});
