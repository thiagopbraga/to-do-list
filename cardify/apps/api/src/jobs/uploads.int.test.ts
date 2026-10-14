import { documents, eq } from '@cardify/db';
import { LIMITES_ANONIMO, LIMITES_DOCUMENTO } from '@cardify/shared';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import { comoAnonimo, comoUsuario, criarSessaoAnonima, criarUsuario, lerFixturePdf } from './helpers-teste';
import { sha256Hex } from './util';

describe('uploads', () => {
  let t: AppTeste;

  beforeAll(async () => {
    t = await criarAppTeste();
  });
  afterAll(() => t.fechar());
  beforeEach(() => t.banco.limpar());

  const criar = (headers: Record<string, string>, corpo: object) =>
    t.app.inject({ method: 'POST', url: '/v1/uploads', headers, payload: corpo });

  describe('POST /v1/uploads', () => {
    it('cria o documento e devolve a URL de upload', async () => {
      const userId = await criarUsuario(t);
      const res = await criar(comoUsuario(userId), { nome: 'aula.pdf', bytes: 1000, contentType: 'application/pdf' });

      expect(res.statusCode).toBe(201);
      const { documentId, upload } = res.json();
      const [doc] = await t.banco.db.select().from(documents).where(eq(documents.id, documentId));
      expect(doc).toMatchObject({
        userId,
        anonSessionId: null,
        tipo: 'pdf',
        status: 'aguardando_upload',
        sha256: '',
        nome: 'aula.pdf',
        storageKey: `docs/u-${userId}/${documentId}/original`,
      });
      expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6.9 * 86_400_000);
      expect(upload.url).toContain(doc.storageKey);
      expect(upload.campos).toBeDefined();
    });

    it('aplica o limite de bytes: anônimo 5 MB, logado 50 MB', async () => {
      const userId = await criarUsuario(t);
      const anonId = await criarSessaoAnonima(t);
      const corpo = (bytes: number) => ({ nome: 'a.pdf', bytes, contentType: 'application/pdf' });

      const anonimo = await criar(comoAnonimo(anonId), corpo(LIMITES_ANONIMO.maxBytes + 1));
      expect(anonimo.statusCode).toBe(422);
      expect(anonimo.json().erro).toBe('documento_muito_grande');
      expect((await criar(comoAnonimo(anonId), corpo(LIMITES_ANONIMO.maxBytes))).statusCode).toBe(201);

      expect((await criar(comoUsuario(userId), corpo(LIMITES_ANONIMO.maxBytes + 1))).statusCode).toBe(201);
      expect((await criar(comoUsuario(userId), corpo(LIMITES_DOCUMENTO.maxBytes + 1))).statusCode).toBe(422);
    });

    it('associa o documento à sessão anônima', async () => {
      const anonId = await criarSessaoAnonima(t);
      const res = await criar(comoAnonimo(anonId), { nome: 'a.pdf', bytes: 10, contentType: 'application/pdf' });
      const [doc] = await t.banco.db.select().from(documents).where(eq(documents.id, res.json().documentId));
      expect(doc).toMatchObject({ userId: null, anonSessionId: anonId });
      expect(doc.storageKey).toBe(`docs/a-${anonId}/${doc.id}/original`);
    });

    it('rejeita corpo inválido e exige sessão', async () => {
      const userId = await criarUsuario(t);
      const invalido = await criar(comoUsuario(userId), { nome: '', bytes: 0, contentType: 'image/png' });
      expect(invalido.statusCode).toBe(400);
      expect(invalido.json().erro).toBe('requisicao_invalida');
      expect((await criar({}, { nome: 'a.pdf', bytes: 10, contentType: 'application/pdf' })).statusCode).toBe(401);
    });
  });

  describe('POST /v1/uploads/:id/concluir', () => {
    const concluir = (headers: Record<string, string>, id: string) =>
      t.app.inject({ method: 'POST', url: `/v1/uploads/${id}/concluir`, headers });

    async function novoUpload(userId: string) {
      const res = await criar(comoUsuario(userId), { nome: 'slides.pdf', bytes: 100, contentType: 'application/pdf' });
      const { documentId } = res.json();
      const [doc] = await t.banco.db.select().from(documents).where(eq(documents.id, documentId));
      return doc;
    }

    it('grava sha256, bytes e status enviado', async () => {
      const userId = await criarUsuario(t);
      const doc = await novoUpload(userId);
      const pdf = lerFixturePdf('slides.pdf');
      await t.storage.gravar(doc.storageKey, pdf, 'application/pdf');

      const res = await concluir(comoUsuario(userId), doc.id);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ documentId: doc.id, sha256: sha256Hex(pdf), bytes: pdf.length });
      const [depois] = await t.banco.db.select().from(documents).where(eq(documents.id, doc.id));
      expect(depois).toMatchObject({ status: 'enviado', sha256: sha256Hex(pdf), bytes: pdf.length });
    });

    it('é idempotente', async () => {
      const userId = await criarUsuario(t);
      const doc = await novoUpload(userId);
      await t.storage.gravar(doc.storageKey, lerFixturePdf('slides.pdf'), 'application/pdf');

      const primeira = await concluir(comoUsuario(userId), doc.id);
      await t.storage.apagar(doc.storageKey);
      const segunda = await concluir(comoUsuario(userId), doc.id);

      expect(segunda.statusCode).toBe(200);
      expect(segunda.json()).toEqual(primeira.json());
    });

    it('409 upload_pendente enquanto o objeto não existe', async () => {
      const userId = await criarUsuario(t);
      const doc = await novoUpload(userId);
      const res = await concluir(comoUsuario(userId), doc.id);
      expect(res.statusCode).toBe(409);
      expect(res.json().erro).toBe('upload_pendente');
    });

    it('arquivo que não é PDF: 422, objeto apagado e documento invalido', async () => {
      const userId = await criarUsuario(t);
      const doc = await novoUpload(userId);
      await t.storage.gravar(doc.storageKey, Buffer.from('isto nao e um pdf'), 'application/pdf');

      const res = await concluir(comoUsuario(userId), doc.id);

      expect(res.statusCode).toBe(422);
      expect(res.json().erro).toBe('documento_tipo_invalido');
      expect(await t.storage.metadados(doc.storageKey)).toBeNull();
      const [depois] = await t.banco.db.select().from(documents).where(eq(documents.id, doc.id));
      expect(depois.status).toBe('invalido');
    });

    it('outro dono recebe 404 e o documento não muda', async () => {
      const userId = await criarUsuario(t);
      const outro = await criarUsuario(t, 'bia@exemplo.com');
      const anonId = await criarSessaoAnonima(t);
      const doc = await novoUpload(userId);
      await t.storage.gravar(doc.storageKey, lerFixturePdf('slides.pdf'), 'application/pdf');

      for (const headers of [comoUsuario(outro), comoAnonimo(anonId)]) {
        const res = await concluir(headers, doc.id);
        expect(res.statusCode).toBe(404);
        expect(res.json().erro).toBe('nao_encontrado');
      }
      expect((await concluir(comoUsuario(userId), 'nao-e-uuid')).statusCode).toBe(404);
      const [depois] = await t.banco.db.select().from(documents).where(eq(documents.id, doc.id));
      expect(depois.status).toBe('aguardando_upload');
    });
  });
});
