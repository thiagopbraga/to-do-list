import type { RegistroChamadaLlm } from '@cardify/shared';
import { type Db, LedgerLlmDb, anonGastoDiario, anonSessions, bancoDeTeste, documents, eq, jobs, llmCalls } from './index';

let banco: Awaited<ReturnType<typeof bancoDeTeste>>;
let db: Db;
let jobId: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  db = banco.db;
});

afterAll(async () => {
  await banco.fechar();
});

beforeEach(async () => {
  await banco.limpar();
  const [sessao] = await db
    .insert(anonSessions)
    .values({ ipHash: 'ip', expiresAt: new Date(Date.now() + 86_400_000) })
    .returning();
  const [documento] = await db
    .insert(documents)
    .values({
      anonSessionId: sessao.id,
      tipo: 'texto',
      sha256: 'a'.repeat(64),
      nome: 'x',
      storageKey: 'k',
      status: 'enviado',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({
      anonSessionId: sessao.id,
      documentId: documento.id,
      status: 'pendente',
      params: { densidade: 'equilibrado', tipo: 'misto', area: 'geral' },
      paramsHash: 'h',
      orcamentoCentavos: 10,
    })
    .returning();
  jobId = job.id;
});

const registro = (custoCentavos: number): RegistroChamadaLlm => ({
  jobId,
  estagio: 'extracao',
  modelo: 'claude-haiku-5-5',
  tokensIn: 100,
  tokensOut: 50,
  custoCentavos,
  latenciaMs: 120,
});

describe('LedgerLlmDb', () => {
  it('registra a chamada em llm_calls sem tocar o gasto anônimo quando o job é de usuário', async () => {
    await new LedgerLlmDb(db, { anonimo: false }).registrar(registro(0.25));

    const linhas = await db.select().from(llmCalls).where(eq(llmCalls.jobId, jobId));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      estagio: 'extracao',
      modelo: 'claude-haiku-5-5',
      tokensIn: 100,
      tokensOut: 50,
      custoCentavos: 0.25,
      latenciaMs: 120,
    });
    expect(await db.select().from(anonGastoDiario)).toHaveLength(0);
  });

  it('soma o custo em anon_gasto_diario (dia UTC) quando o job é anônimo', async () => {
    const ledger = new LedgerLlmDb(db, { anonimo: true });
    await ledger.registrar(registro(0.25));
    await ledger.registrar(registro(0.5));

    const dias = await db.select().from(anonGastoDiario);
    expect(dias).toHaveLength(1);
    expect(dias[0].dia).toBe(new Date().toISOString().slice(0, 10));
    expect(dias[0].gastoCentavos).toBeCloseTo(0.75, 10);
    expect(await db.select().from(llmCalls)).toHaveLength(2);
  });

  it('não perde somas em chamadas concorrentes', async () => {
    const ledger = new LedgerLlmDb(db, { anonimo: true });
    await Promise.all(Array.from({ length: 10 }, () => ledger.registrar(registro(0.1))));

    const [dia] = await db.select().from(anonGastoDiario);
    expect(dia.gastoCentavos).toBeCloseTo(1, 10);
  });
});
