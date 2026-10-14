import { randomUUID } from 'node:crypto';
import { anonSessions, cards, documents, eq, exportacoes, jobs, users } from '@cardify/db';
import { type ContextoTeste, criarContextoTeste, criarJobTeste } from '../testing/contexto-teste';
import { RetencaoService } from './retencao.service';

const DIA_MS = 24 * 60 * 60 * 1000;
const dias = (n: number, referencia: Date) => new Date(referencia.getTime() + n * DIA_MS);

let ctx: ContextoTeste;

async function iniciar(): Promise<ContextoTeste> {
  ctx = await criarContextoTeste();
  await ctx.banco.limpar();
  return ctx;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await ctx?.fechar();
});

const retencao = () => ctx.modulo.get(RetencaoService);

async function documentoDoJob(jobId: string) {
  const [job] = await ctx.db.select().from(jobs).where(eq(jobs.id, jobId));
  const [doc] = await ctx.db.select().from(documents).where(eq(documents.id, job.documentId));
  return doc;
}

async function documentoComObjetos(opcoes: { expiraEm: Date; comTexto?: boolean }) {
  const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: `pdf ${randomUUID()}`, estimativa: 5 });
  let textoExtraidoKey: string | null = null;
  if (opcoes.comTexto) {
    textoExtraidoKey = `texto/${randomUUID()}.txt`;
    await ctx.storage.gravar(textoExtraidoKey, 'texto extraído', 'text/plain');
  }
  const doc = await documentoDoJob(job.id);
  await ctx.db
    .update(documents)
    .set({ expiresAt: opcoes.expiraEm, textoExtraidoKey })
    .where(eq(documents.id, doc.id));
  return { job, documentoId: doc.id, storageKey: doc.storageKey, textoExtraidoKey };
}

async function criarCard(jobId: string) {
  await ctx.db.insert(cards).values({ jobId, tipo: 'basico', frente: 'frente', verso: 'verso', ordem: 0 });
}

async function exportacaoComObjeto(jobId: string, expiraEm: Date) {
  const storageKey = `exports/${randomUUID()}.apkg`;
  await ctx.storage.gravar(storageKey, 'apkg', 'application/octet-stream');
  await ctx.db.insert(exportacoes).values({ jobId, formato: 'apkg', status: 'pronto', storageKey, expiresAt: expiraEm });
  return storageKey;
}

describe('RetencaoService — documentos', () => {
  it('documento expirado ontem: apaga original e texto extraído do storage e preserva linha e cards', async () => {
    await iniciar();
    const agora = new Date();
    const { job, documentoId, storageKey, textoExtraidoKey } = await documentoComObjetos({
      expiraEm: dias(-1, agora),
      comTexto: true,
    });
    await criarCard(job.id);

    await retencao().executar(agora);

    expect(await ctx.storage.metadados(storageKey)).toBeNull();
    expect(await ctx.storage.metadados(textoExtraidoKey as string)).toBeNull();
    const [linha] = await ctx.db.select().from(documents).where(eq(documents.id, documentoId));
    expect(linha).toMatchObject({ storageKey, textoExtraidoKey });
    expect(await ctx.db.select().from(cards).where(eq(cards.jobId, job.id))).toHaveLength(1);
  });

  it('documento com expires_at no futuro fica intocado', async () => {
    await iniciar();
    const agora = new Date();
    const { storageKey, textoExtraidoKey } = await documentoComObjetos({ expiraEm: dias(1, agora), comTexto: true });

    await retencao().executar(agora);

    expect(await ctx.storage.metadados(storageKey)).not.toBeNull();
    expect(await ctx.storage.metadados(textoExtraidoKey as string)).not.toBeNull();
  });

  it('documento expirado há 10 dias fica fora da janela padrão e é apagado com janelaDias: 30', async () => {
    await iniciar();
    const agora = new Date();
    const { storageKey } = await documentoComObjetos({ expiraEm: dias(-10, agora) });

    await retencao().executar(agora);
    expect(await ctx.storage.metadados(storageKey)).not.toBeNull();

    await retencao().executar(agora, { janelaDias: 30 });
    expect(await ctx.storage.metadados(storageKey)).toBeNull();
  });
});

describe('RetencaoService — exportações', () => {
  it('exportação expirada tem o objeto apagado; exportação válida fica', async () => {
    await iniciar();
    const agora = new Date();
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: 'texto de teste', estimativa: 5 });
    const expirada = await exportacaoComObjeto(job.id, dias(-1, agora));
    const valida = await exportacaoComObjeto(job.id, dias(5, agora));

    await retencao().executar(agora);

    expect(await ctx.storage.metadados(expirada)).toBeNull();
    expect(await ctx.storage.metadados(valida)).not.toBeNull();
  });
});

describe('RetencaoService — sessões anônimas abandonadas', () => {
  it('sessão anônima abandonada há 8 dias: sessão, documentos, jobs, cards, exportações e objetos somem', async () => {
    await iniciar();
    const agora = new Date();
    const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: 'pdf anônimo', anonimo: true, estimativa: 5 });
    const sessaoId = job.anonSessionId as string;
    const doc = await documentoDoJob(job.id);
    await criarCard(job.id);
    const exportacao = await exportacaoComObjeto(job.id, dias(5, agora));
    await ctx.db.update(anonSessions).set({ expiresAt: dias(-8, agora) }).where(eq(anonSessions.id, sessaoId));

    await retencao().executar(agora);

    expect(await ctx.db.select().from(anonSessions).where(eq(anonSessions.id, sessaoId))).toHaveLength(0);
    expect(await ctx.db.select().from(documents).where(eq(documents.id, doc.id))).toHaveLength(0);
    expect(await ctx.db.select().from(jobs).where(eq(jobs.id, job.id))).toHaveLength(0);
    expect(await ctx.db.select().from(cards).where(eq(cards.jobId, job.id))).toHaveLength(0);
    expect(await ctx.db.select().from(exportacoes).where(eq(exportacoes.jobId, job.id))).toHaveLength(0);
    expect(await ctx.storage.metadados(doc.storageKey)).toBeNull();
    expect(await ctx.storage.metadados(exportacao)).toBeNull();
  });

  it('sessão vinculada a usuário não é apagada, mesmo expirada há 8 dias', async () => {
    await iniciar();
    const agora = new Date();
    const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: 'pdf vinculado', anonimo: true, estimativa: 5 });
    const sessaoId = job.anonSessionId as string;
    const doc = await documentoDoJob(job.id);
    const [usuario] = await ctx.db.insert(users).values({ email: 'vinculado@exemplo.com' }).returning();

    // Mesmo efeito de vincularTrabalhoAnonimo (apps/api/src/auth/sessoes.service.ts).
    await ctx.db
      .update(anonSessions)
      .set({ userId: usuario.id, expiresAt: dias(-8, agora) })
      .where(eq(anonSessions.id, sessaoId));
    await ctx.db.update(documents).set({ userId: usuario.id, anonSessionId: null }).where(eq(documents.id, doc.id));
    await ctx.db.update(jobs).set({ userId: usuario.id, anonSessionId: null }).where(eq(jobs.id, job.id));

    await retencao().executar(agora);

    expect(await ctx.db.select().from(anonSessions).where(eq(anonSessions.id, sessaoId))).toHaveLength(1);
    expect(await ctx.db.select().from(documents).where(eq(documents.id, doc.id))).toHaveLength(1);
    expect(await ctx.storage.metadados(doc.storageKey)).not.toBeNull();
  });

  it('sessão anônima expirada há 2 dias não é apagada', async () => {
    await iniciar();
    const agora = new Date();
    const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: 'pdf recente', anonimo: true, estimativa: 5 });
    const sessaoId = job.anonSessionId as string;
    const doc = await documentoDoJob(job.id);
    await ctx.db.update(anonSessions).set({ expiresAt: dias(-2, agora) }).where(eq(anonSessions.id, sessaoId));

    await retencao().executar(agora);

    expect(await ctx.db.select().from(anonSessions).where(eq(anonSessions.id, sessaoId))).toHaveLength(1);
    expect(await ctx.db.select().from(documents).where(eq(documents.id, doc.id))).toHaveLength(1);
    expect(await ctx.storage.metadados(doc.storageKey)).not.toBeNull();
  });
});

describe('RetencaoService — falhas e idempotência', () => {
  it('falha do storage em um objeto não impede os demais e a próxima execução tenta de novo', async () => {
    await iniciar();
    const agora = new Date();
    const falha = await documentoComObjetos({ expiraEm: dias(-1, agora) });
    const ok = await documentoComObjetos({ expiraEm: dias(-1, agora) });

    const apagarOriginal = ctx.storage.apagar.bind(ctx.storage);
    vi.spyOn(ctx.storage, 'apagar').mockImplementation(async (chave: string) => {
      if (chave === falha.storageKey) throw new Error('storage indisponível');
      return apagarOriginal(chave);
    });

    const resumo = await retencao().executar(agora);

    expect(resumo.falhas).toBe(1);
    expect(await ctx.storage.metadados(ok.storageKey)).toBeNull();
    expect(await ctx.storage.metadados(falha.storageKey)).not.toBeNull();

    vi.restoreAllMocks();
    await retencao().executar(agora);

    expect(await ctx.storage.metadados(falha.storageKey)).toBeNull();
  });

  it('falha ao apagar objeto de sessão anônima mantém a sessão para a próxima execução', async () => {
    await iniciar();
    const agora = new Date();
    const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: 'pdf com falha', anonimo: true, estimativa: 5 });
    const sessaoId = job.anonSessionId as string;
    const doc = await documentoDoJob(job.id);
    await ctx.db.update(anonSessions).set({ expiresAt: dias(-8, agora) }).where(eq(anonSessions.id, sessaoId));

    vi.spyOn(ctx.storage, 'apagar').mockRejectedValue(new Error('storage indisponível'));
    await retencao().executar(agora);

    expect(await ctx.db.select().from(anonSessions).where(eq(anonSessions.id, sessaoId))).toHaveLength(1);
    expect(await ctx.storage.metadados(doc.storageKey)).not.toBeNull();

    vi.restoreAllMocks();
    await retencao().executar(agora);

    expect(await ctx.db.select().from(anonSessions).where(eq(anonSessions.id, sessaoId))).toHaveLength(0);
    expect(await ctx.storage.metadados(doc.storageKey)).toBeNull();
  });

  it('executar duas vezes seguidas é idempotente', async () => {
    await iniciar();
    const agora = new Date();
    const doc = await documentoComObjetos({ expiraEm: dias(-1, agora), comTexto: true });
    const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: 'pdf anônimo', anonimo: true, estimativa: 5 });
    await ctx.db
      .update(anonSessions)
      .set({ expiresAt: dias(-8, agora) })
      .where(eq(anonSessions.id, job.anonSessionId as string));

    const primeira = await retencao().executar(agora);
    const segunda = await retencao().executar(agora);

    expect(primeira).toEqual({ objetosRemovidos: 3, sessoesRemovidas: 1, falhas: 0 });
    expect(segunda).toEqual({ objetosRemovidos: 0, sessoesRemovidas: 0, falhas: 0 });
    expect(await ctx.storage.metadados(doc.storageKey)).toBeNull();
    expect(await ctx.db.select().from(documents).where(eq(documents.id, doc.documentoId))).toHaveLength(1);
  });
});
