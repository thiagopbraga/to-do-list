import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { lerZip } from '@cardify/apkg';
import { MODEL_ID_CLOZE, chaveStorage, donoStorage } from '@cardify/shared';
import { type Db, eq, exportacoes } from '@cardify/db';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import { criarCard, criarJob, criarSessaoAnonima, criarUsuario } from './testing/semear';

const CLOZE = 'O coração {{c1::bombeia}} sangue e o {{c2::oxigênio}} segue para os tecidos';

let t: AppTeste;
let db: Db;
let userId: string;
let jobId: string;

beforeAll(async () => {
  t = await criarAppTeste();
  db = t.banco.db;
});

afterAll(() => t.fechar());

beforeEach(async () => {
  await t.banco.limpar();
  userId = await criarUsuario(db);
  ({ jobId } = await criarJob(db, { userId }, { nomeDocumento: 'Aula de Fisiologia.pdf' }));
  await criarCard(db, jobId, { ordem: 0, frente: 'O que é o átrio?', verso: 'Câmara de entrada & saída' });
  await criarCard(db, jobId, { ordem: 1, frente: 'Quantas valvas?', verso: 'Quatro' });
  await criarCard(db, jobId, { ordem: 2, tipo: 'cloze', frente: 'O coração bombeia sangue e o oxigênio segue para os tecidos', textoCloze: CLOZE, verso: 'bombeia' });
  await criarCard(db, jobId, { ordem: 3, estado: 'descartado', frente: 'Descartado?' });
});

const logado = (usuario = userId): Record<string, string> => ({ 'x-teste-user': usuario });

async function exportar(formato: 'apkg' | 'csv' | 'tsv', headers: Record<string, string> = logado(), alvo = jobId) {
  return t.app.inject({ method: 'POST', url: '/v1/exports', headers, payload: { jobId: alvo, formato } });
}

async function conteudoDaExportacao(id: string): Promise<Buffer> {
  const [linha] = await db.select().from(exportacoes).where(eq(exportacoes.id, id));
  return t.storage.ler(linha.storageKey!);
}

describe('POST /v1/exports', () => {
  it('apkg: 201, objeto gravado e zip com uma nota por card não descartado', async () => {
    const res = await exportar('apkg');
    expect(res.statusCode).toBe(201);
    const corpo = res.json();
    expect(corpo).toMatchObject({ formato: 'apkg' });
    expect(corpo.bytes).toBeGreaterThan(0);

    const [linha] = await db.select().from(exportacoes).where(eq(exportacoes.id, corpo.id));
    expect(linha).toMatchObject({ status: 'pronto', formato: 'apkg', bytes: corpo.bytes, jobId });
    expect(linha.storageKey).toBe(chaveStorage.exportacao(donoStorage({ userId }), corpo.id, 'apkg'));
    const diasAteExpirar = (linha.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diasAteExpirar).toBeGreaterThan(29);
    expect(diasAteExpirar).toBeLessThanOrEqual(30);

    const zip = await lerZip(await conteudoDaExportacao(corpo.id));
    const colecao = zip.get('collection.anki2');
    expect(colecao).toBeDefined();

    const diretorio = await mkdtemp(path.join(tmpdir(), 'cardify-teste-apkg-'));
    try {
      const arquivo = path.join(diretorio, 'collection.anki2');
      await writeFile(arquivo, colecao!);
      const sqlite = new Database(arquivo, { readonly: true });
      try {
        const { total: notas } = sqlite.prepare('SELECT count(*) AS total FROM notes').get() as { total: number };
        expect(notas).toBe(3);

        const { total: linhasCards } = sqlite.prepare('SELECT count(*) AS total FROM cards').get() as { total: number };
        expect(linhasCards).toBe(4);

        const { mid } = sqlite.prepare("SELECT mid FROM notes WHERE flds LIKE '%{{c1::%' LIMIT 1").get() as { mid: number };
        expect(mid).toBe(MODEL_ID_CLOZE);
      } finally {
        sqlite.close();
      }
    } finally {
      await rm(diretorio, { recursive: true, force: true });
    }
  });

  it('csv e tsv: cabeçalho do separador e conteúdo em UTF-8', async () => {
    const csv = await exportar('csv');
    expect(csv.statusCode).toBe(201);
    const textoCsv = (await conteudoDaExportacao(csv.json().id)).toString('utf8');
    expect(textoCsv.startsWith('#separator:Comma\n')).toBe(true);
    expect(textoCsv).toContain('O que é o átrio?');
    expect(textoCsv).not.toContain('Descartado?');

    const tsv = await exportar('tsv');
    expect(tsv.statusCode).toBe(201);
    const textoTsv = (await conteudoDaExportacao(tsv.json().id)).toString('utf8');
    expect(textoTsv.startsWith('#separator:Tab\n')).toBe(true);
  });

  it('job pendente responde 409 job_nao_finalizado', async () => {
    const { jobId: pendente } = await criarJob(db, { userId }, { status: 'pendente' });
    await criarCard(db, pendente);
    const res = await exportar('apkg', logado(), pendente);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ erro: 'job_nao_finalizado' });
  });

  it('job parcial também exporta', async () => {
    const { jobId: parcial } = await criarJob(db, { userId }, { status: 'parcial' });
    await criarCard(db, parcial);
    const res = await exportar('csv', logado(), parcial);
    expect(res.statusCode).toBe(201);
  });

  it('sem cards não descartados responde 409 sem_cards', async () => {
    const { jobId: vazio } = await criarJob(db, { userId });
    await criarCard(db, vazio, { estado: 'descartado' });
    const res = await exportar('apkg', logado(), vazio);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ erro: 'sem_cards' });
  });

  it('anônimo recebe 401 login_necessario', async () => {
    const anonId = await criarSessaoAnonima(db);
    const { jobId: jobAnonimo } = await criarJob(db, { anonSessionId: anonId });
    await criarCard(db, jobAnonimo);
    const res = await exportar('apkg', { 'x-teste-anon': anonId }, jobAnonimo);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ message: 'login_necessario' });
  });

  it('job de outro usuário responde 404', async () => {
    const outro = await criarUsuario(db);
    const res = await exportar('apkg', logado(outro));
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ erro: 'nao_encontrado' });
  });
});

describe('GET /v1/exports/:id/download', () => {
  async function criarExportacao(): Promise<string> {
    const res = await exportar('apkg');
    return res.json().id;
  }

  it('responde 302 com a URL assinada contendo a chave do objeto', async () => {
    const id = await criarExportacao();
    const res = await t.app.inject({ method: 'GET', url: `/v1/exports/${id}/download`, headers: logado() });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain(chaveStorage.exportacao(donoStorage({ userId }), id, 'apkg'));
  });

  it('dono errado recebe 404', async () => {
    const id = await criarExportacao();
    const outro = await criarUsuario(db);
    const res = await t.app.inject({ method: 'GET', url: `/v1/exports/${id}/download`, headers: logado(outro) });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ erro: 'nao_encontrado' });
  });

  it('exportação expirada responde 410', async () => {
    const id = await criarExportacao();
    await db.update(exportacoes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(exportacoes.id, id));
    const res = await t.app.inject({ method: 'GET', url: `/v1/exports/${id}/download`, headers: logado() });
    expect(res.statusCode).toBe(410);
  });

  it('pede a URL assinada com TTL de 15 min e nome do arquivo sem extensão do documento', async () => {
    const id = await criarExportacao();
    const espiao = vi.spyOn(t.storage, 'urlDownload');
    try {
      const res = await t.app.inject({ method: 'GET', url: `/v1/exports/${id}/download`, headers: logado() });
      expect(res.statusCode).toBe(302);
      expect(espiao).toHaveBeenCalledWith(expect.any(String), {
        ttlSegundos: 15 * 60,
        nomeArquivo: 'Aula de Fisiologia.apkg',
      });
    } finally {
      espiao.mockRestore();
    }
  });
});
