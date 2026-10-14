import {
  CardEstadoSchema,
  CardTipoSchema,
  EstagioSchema,
  ExportFormatoSchema,
  JobStatusSchema,
  PlanoSchema,
} from '@cardify/shared';
import {
  type Db,
  bancoDeTeste,
  cardEstadoEnum,
  cardTipoEnum,
  cards,
  chunks,
  documents,
  estagioEnum,
  eq,
  exportFormatoEnum,
  jobStatusEnum,
  jobs,
  llmCalls,
  planoEnum,
  anonSessions,
  sql,
  subscriptions,
  users,
} from './index';

let banco: Awaited<ReturnType<typeof bancoDeTeste>>;
let db: Db;

beforeAll(async () => {
  banco = await bancoDeTeste();
  db = banco.db;
});

afterAll(async () => {
  await banco.fechar();
});

beforeEach(async () => {
  await banco.limpar();
});

const PARAMS = { densidade: 'equilibrado', tipo: 'misto', area: 'geral' } as const;

async function criarUsuarioEDocumento() {
  const [usuario] = await db.insert(users).values({ email: 'ana@exemplo.com' }).returning();
  const [documento] = await db
    .insert(documents)
    .values({
      userId: usuario.id,
      tipo: 'texto',
      sha256: 'a'.repeat(64),
      nome: 'resumo.txt',
      storageKey: 'docs/u-x/doc/original',
      status: 'processado',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  return { usuario, documento };
}

async function criarJob(documentId: string, userId: string | null, idempotencyKey: string | null = null) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId,
      documentId,
      status: 'pendente',
      params: PARAMS,
      paramsHash: 'hash-params',
      orcamentoCentavos: 50,
      idempotencyKey,
    })
    .returning();
  return job;
}

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    let atual: unknown = erro;
    while (atual && typeof atual === 'object') {
      if ('code' in atual && typeof atual.code === 'string') return atual.code;
      atual = (atual as { cause?: unknown }).cause;
    }
    throw erro;
  }
}

describe('schema de banco', () => {
  it('enums espelham os schemas zod de @cardify/shared', () => {
    expect(planoEnum.enumValues).toEqual(PlanoSchema.options);
    expect(jobStatusEnum.enumValues).toEqual(JobStatusSchema.options);
    expect(estagioEnum.enumValues).toEqual(EstagioSchema.options);
    expect(cardTipoEnum.enumValues).toEqual(CardTipoSchema.options);
    expect(cardEstadoEnum.enumValues).toEqual(CardEstadoSchema.options);
    expect(exportFormatoEnum.enumValues).toEqual(ExportFormatoSchema.options);
  });

  it('grava o fluxo documento → job → chunk → cards → llm_call', async () => {
    const { usuario, documento } = await criarUsuarioEDocumento();
    const job = await criarJob(documento.id, usuario.id);

    const [chunk] = await db
      .insert(chunks)
      .values({ jobId: job.id, ordem: 0, trilhaTitulos: ['Fisiologia'], texto: 'Texto do chunk', tokens: 12 })
      .returning();

    await db.insert(cards).values([
      {
        jobId: job.id,
        chunkId: chunk.id,
        tipo: 'basico',
        frente: 'Qual o órgão?',
        verso: 'Coração',
        ordem: 0,
        tags: ['cardio'],
      },
      {
        jobId: job.id,
        chunkId: chunk.id,
        tipo: 'cloze',
        frente: 'O coração tem quatro câmaras',
        verso: 'quatro',
        textoCloze: 'O coração tem {{c1::quatro}} câmaras',
        ordem: 1,
      },
    ]);

    await db.insert(llmCalls).values({
      jobId: job.id,
      estagio: 'geracao',
      modelo: 'modelo-teste',
      tokensIn: 100,
      tokensOut: 50,
      custoCentavos: 0.0123,
      latenciaMs: 800,
    });

    const cardsGravados = await db.select().from(cards).where(eq(cards.jobId, job.id)).orderBy(cards.ordem);
    expect(cardsGravados.map((c) => c.frente)).toEqual(['Qual o órgão?', 'O coração tem quatro câmaras']);
    expect(cardsGravados[0].tags).toEqual(['cardio']);
    expect(cardsGravados[0].trilhaTitulos).toEqual([]);
    expect(cardsGravados[0].estado).toBe('gerado');

    const [chunkGravado] = await db.select().from(chunks).where(eq(chunks.jobId, job.id));
    expect(chunkGravado.trilhaTitulos).toEqual(['Fisiologia']);

    const [llm] = await db.select().from(llmCalls).where(eq(llmCalls.jobId, job.id));
    expect(llm.custoCentavos).toBeCloseTo(0.0123);
  });

  it('idempotency_key é único quando preenchida e aceita nulos repetidos', async () => {
    const { usuario, documento } = await criarUsuarioEDocumento();
    await criarJob(documento.id, usuario.id, 'chave-1');

    const duplicado = codigoDoErro(criarJob(documento.id, usuario.id, 'chave-1'));
    expect(await duplicado).toBe('23505');

    await criarJob(documento.id, usuario.id, null);
    await criarJob(documento.id, usuario.id, null);
  });

  it('CHECK de documento rejeita dono nulo e dono duplo', async () => {
    const [anon] = await db.insert(anonSessions).values({
      ipHash: 'ip-hash',
      expiresAt: new Date(Date.now() + 3_600_000),
    }).returning();
    const { usuario } = await criarUsuarioEDocumento();

    const base = {
      tipo: 'pdf' as const,
      sha256: 'b'.repeat(64),
      nome: 'apostila.pdf',
      storageKey: 'docs/x/original',
      status: 'enviado' as const,
      expiresAt: new Date(Date.now() + 86_400_000),
    };

    expect(await codigoDoErro(db.insert(documents).values(base))).toBe('23514');
    expect(
      await codigoDoErro(db.insert(documents).values({ ...base, userId: usuario.id, anonSessionId: anon.id })),
    ).toBe('23514');
    await db.insert(documents).values({ ...base, anonSessionId: anon.id });
  });

  it('apagar o job remove chunks, cards e llm_calls em cascata', async () => {
    const { usuario, documento } = await criarUsuarioEDocumento();
    const job = await criarJob(documento.id, usuario.id);
    const [chunk] = await db
      .insert(chunks)
      .values({ jobId: job.id, ordem: 0, texto: 'x', tokens: 1 })
      .returning();
    await db.insert(cards).values([
      { jobId: job.id, chunkId: chunk.id, tipo: 'basico', frente: 'pergunta', verso: 'resposta', ordem: 0 },
      { jobId: job.id, chunkId: chunk.id, tipo: 'basico', frente: 'pergunta 2', verso: 'resposta 2', ordem: 1 },
    ]);
    await db.insert(llmCalls).values({
      jobId: job.id,
      estagio: 'geracao',
      modelo: 'm',
      tokensIn: 1,
      tokensOut: 1,
      custoCentavos: 0,
      latenciaMs: 1,
    });

    await db.delete(jobs).where(eq(jobs.id, job.id));

    const contar = async (tabela: 'chunks' | 'cards' | 'llm_calls') => {
      const resultado = await db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM ${sql.identifier(tabela)} WHERE job_id = ${job.id}`,
      );
      return resultado.rows[0].n;
    };
    expect(await contar('chunks')).toBe(0);
    expect(await contar('cards')).toBe(0);
    expect(await contar('llm_calls')).toBe(0);
  });

  it('apagar o user apaga documents, jobs, cards e assinaturas dele em cascata', async () => {
    const { usuario, documento } = await criarUsuarioEDocumento();
    const job = await criarJob(documento.id, usuario.id);
    const [chunk] = await db.insert(chunks).values({ jobId: job.id, ordem: 0, texto: 'x', tokens: 1 }).returning();
    await db.insert(cards).values({
      jobId: job.id,
      chunkId: chunk.id,
      tipo: 'basico',
      frente: 'pergunta',
      verso: 'resposta',
      ordem: 0,
    });
    await db.insert(subscriptions).values({ userId: usuario.id, plano: 'essencial', status: 'ativa' });

    await db.delete(users).where(eq(users.id, usuario.id));

    expect(await db.select().from(documents)).toHaveLength(0);
    expect(await db.select().from(jobs)).toHaveLength(0);
    expect(await db.select().from(cards)).toHaveLength(0);
    expect(await db.select().from(subscriptions)).toHaveLength(0);
  });

  it('apagar anon_session apaga seus documents e jobs em cascata', async () => {
    const [anon] = await db
      .insert(anonSessions)
      .values({ ipHash: 'ip-hash', expiresAt: new Date(Date.now() + 3_600_000) })
      .returning();
    const [documento] = await db
      .insert(documents)
      .values({
        anonSessionId: anon.id,
        tipo: 'texto',
        sha256: 'c'.repeat(64),
        nome: 'amostra.txt',
        storageKey: 'docs/a-x/doc/original',
        status: 'processado',
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    await db.insert(jobs).values({
      anonSessionId: anon.id,
      documentId: documento.id,
      status: 'pendente',
      params: PARAMS,
      paramsHash: 'hash-params',
      orcamentoCentavos: 5,
      amostra: true,
    });
    expect(await db.select().from(jobs)).toHaveLength(1);

    await db.delete(anonSessions).where(eq(anonSessions.id, anon.id));

    expect(await db.select().from(documents)).toHaveLength(0);
    expect(await db.select().from(jobs)).toHaveLength(0);
  });

  it('job sem dono (user_id e anon_session_id nulos) é rejeitado pelo CHECK', async () => {
    const { documento } = await criarUsuarioEDocumento();

    expect(await codigoDoErro(criarJob(documento.id, null))).toBe('23514');
  });
});
