import {
  anonGastoDiario,
  cards,
  chunks,
  consultarCota,
  documents,
  eq,
  jobs,
  llmCalls,
  quotaPeriods,
  asc,
  type JobRow,
} from '@cardify/db';
import { FILAS, ProgressoEventoSchema } from '@cardify/shared';
import {
  type ContextoTeste,
  ProviderCobrado,
  ProviderQueFalha,
  criarContextoTeste,
  criarJobTeste,
  lerFixture,
  textoEsparso,
  textoLongo,
} from './testing/contexto-teste';

// Cobre as extrações iniciais e só parte das formulações de ~10 chunks (custo médio de ~6 centavos por chamada).
const ORCAMENTO_PARCIAL = 60;

let ctx: ContextoTeste;

async function iniciar(...args: Parameters<typeof criarContextoTeste>): Promise<ContextoTeste> {
  ctx = await criarContextoTeste(...args);
  await ctx.banco.limpar();
  return ctx;
}

afterEach(async () => {
  await ctx?.fechar();
});

async function carregarJob(jobId: string): Promise<JobRow> {
  const [job] = await ctx.db.select().from(jobs).where(eq(jobs.id, jobId));
  return job;
}

const textoColado = () => lerFixture('texto/colado.txt');

describe('PipelineService — caminho feliz', () => {
  it('texto colado de usuário logado: ingere, gera, confirma a cota e publica progresso crescente até 100', async () => {
    await iniciar();
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado(), estimativa: 40 });

    await ctx.pipeline.executar(job.id);

    const final = await carregarJob(job.id);
    expect(final).toMatchObject({ status: 'concluido', estagioConcluido: 'empacotamento', erro: null, tentativas: 1 });
    expect(final.startedAt).toBeInstanceOf(Date);
    expect(final.finishedAt).toBeInstanceOf(Date);
    expect(final.cardsGerados).toBeGreaterThan(0);
    expect(final.custoCentavos).toBe(0);

    const linhasChunk = await ctx.db.select().from(chunks).where(eq(chunks.jobId, job.id)).orderBy(asc(chunks.ordem));
    expect(linhasChunk.length).toBeGreaterThan(0);
    expect(linhasChunk.map((c) => c.ordem)).toEqual(linhasChunk.map((_, i) => i));
    expect(linhasChunk.every((c) => c.texto.length > 0 && c.tokens > 0)).toBe(true);

    const linhasCard = await ctx.db.select().from(cards).where(eq(cards.jobId, job.id)).orderBy(asc(cards.ordem));
    expect(linhasCard).toHaveLength(final.cardsGerados);
    expect(linhasCard.map((c) => c.ordem)).toEqual(linhasCard.map((_, i) => i));
    const trilhaPorChunk = new Map(linhasChunk.map((c) => [c.id, c.trilhaTitulos]));
    for (const card of linhasCard) {
      expect(card.estado).toBe('gerado');
      expect(card.tags).toEqual([]);
      expect(card.chunkId).not.toBeNull();
      expect(card.trilhaTitulos).toEqual(trilhaPorChunk.get(card.chunkId as string));
    }

    const chamadas = await ctx.db.select().from(llmCalls).where(eq(llmCalls.jobId, job.id));
    expect(chamadas.length).toBeGreaterThan(0);
    expect(new Set(chamadas.map((c) => c.estagio))).toEqual(new Set(['extracao', 'formulacao']));
    expect(await ctx.db.select().from(anonGastoDiario)).toHaveLength(0);

    const [documento] = await ctx.db.select().from(documents).where(eq(documents.id, job.documentId));
    expect(documento.status).toBe('processado');

    const cota = await consultarCota(ctx.db, job.userId as string);
    expect(cota.confirmados).toBe(final.cardsGerados);
    expect(cota.reservados).toBe(0);
    expect(final.cardsReservados).toBe(0);

    const eventos = ctx.publicador.doJob(job.id);
    for (const evento of eventos) expect(ProgressoEventoSchema.safeParse(evento).success).toBe(true);
    const percentuais = eventos.map((e) => e.percentual);
    expect(percentuais).toEqual([...percentuais].sort((a, b) => a - b));
    expect(eventos[0]).toMatchObject({ status: 'ingerindo', estagio: 'ingestao', percentual: 5 });
    expect(eventos.at(-1)).toMatchObject({
      status: 'concluido',
      estagio: 'empacotamento',
      percentual: 100,
      cardsGerados: final.cardsGerados,
    });
  });

  it('PDF de medicina: cards herdam a trilha de títulos e o documento fica com 6 páginas', async () => {
    await iniciar();
    const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: lerFixture('pdf/aula-medicina.pdf'), estimativa: 60 });

    await ctx.pipeline.executar(job.id);

    const final = await carregarJob(job.id);
    expect(final.status).toBe('concluido');
    const linhasCard = await ctx.db.select().from(cards).where(eq(cards.jobId, job.id));
    expect(linhasCard.length).toBeGreaterThan(0);
    expect(linhasCard.every((c) => c.trilhaTitulos.length > 0)).toBe(true);

    const [documento] = await ctx.db.select().from(documents).where(eq(documents.id, job.documentId));
    expect(documento).toMatchObject({ status: 'processado', paginas: 6 });
  });

  it('falha ao publicar progresso não derruba o job', async () => {
    await iniciar();
    ctx.publicador.falhar = true;
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado() });

    await ctx.pipeline.executar(job.id);

    expect((await carregarJob(job.id)).status).toBe('concluido');
    expect(ctx.publicador.eventos).toHaveLength(0);
  });
});

describe('PipelineService — documento inválido', () => {
  it('PDF escaneado: falha definitiva com a mensagem do erro, reserva liberada e sem retry', async () => {
    await iniciar();
    const job = await criarJobTeste(ctx, { tipo: 'pdf', conteudo: lerFixture('pdf/escaneado.pdf'), estimativa: 30 });

    await expect(ctx.pipeline.executar(job.id)).resolves.toBeUndefined();

    const final = await carregarJob(job.id);
    expect(final.status).toBe('falhou');
    expect(final.erro).toMatch(/escaneado|imagens|texto/i);
    expect(final.finishedAt).toBeInstanceOf(Date);
    expect(final.cardsReservados).toBe(0);
    expect(final.tentativas).toBe(1);

    const [documento] = await ctx.db.select().from(documents).where(eq(documents.id, job.documentId));
    expect(documento.status).toBe('invalido');
    expect(await ctx.db.select().from(cards).where(eq(cards.jobId, job.id))).toHaveLength(0);

    const cota = await consultarCota(ctx.db, job.userId as string);
    expect(cota).toMatchObject({ reservados: 0, confirmados: 0 });

    expect(ctx.publicador.doJob(job.id).at(-1)).toMatchObject({
      status: 'falhou',
      estagio: 'ingestao',
      percentual: 100,
      mensagem: final.erro,
    });
  });

  it('texto vazio: falha definitiva sem lançar', async () => {
    await iniciar();
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: '   \n  ' });

    await expect(ctx.pipeline.executar(job.id)).resolves.toBeUndefined();

    const final = await carregarJob(job.id);
    expect(final).toMatchObject({ status: 'falhou', cardsReservados: 0 });
    expect(final.erro).toBeTruthy();
  });
});

describe('PipelineService — anônimo', () => {
  it('respeita o limite de 10 cards e soma o custo em anon_gasto_diario', async () => {
    const provider = new ProviderCobrado({ modelo: 'claude-haiku-5-5' });
    await iniciar(provider);
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoLongo(40), anonimo: true });

    await ctx.pipeline.executar(job.id);

    const final = await carregarJob(job.id);
    expect(final).toMatchObject({ status: 'concluido', cardsGerados: 10 });
    expect(await ctx.db.select().from(cards).where(eq(cards.jobId, job.id))).toHaveLength(10);

    const chamadas = await ctx.db.select().from(llmCalls).where(eq(llmCalls.jobId, job.id));
    const somaLedger = chamadas.reduce((soma, c) => soma + c.custoCentavos, 0);
    expect(somaLedger).toBeGreaterThan(0);
    const [gasto] = await ctx.db.select().from(anonGastoDiario);
    expect(gasto.dia).toBe(new Date().toISOString().slice(0, 10));
    expect(gasto.gastoCentavos).toBeCloseTo(somaLedger, 8);
    expect(final.custoCentavos).toBeCloseTo(somaLedger, 8);
  });
});

describe('PipelineService — checkpoint e retries', () => {
  it('falha na geração relança; a nova execução não reingere e conclui', async () => {
    const provider = new ProviderQueFalha(Number.POSITIVE_INFINITY);
    await iniciar(provider);
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado() });

    await expect(ctx.pipeline.executar(job.id)).rejects.toThrow(/LLM indisponível/);

    const apos1 = await carregarJob(job.id);
    expect(apos1).toMatchObject({ status: 'gerando', estagioConcluido: 'ingestao', tentativas: 1 });
    const chunksAntes = await ctx.db.select().from(chunks).where(eq(chunks.jobId, job.id)).orderBy(asc(chunks.ordem));
    expect(chunksAntes.length).toBeGreaterThan(0);

    provider.falhas = 0;
    await ctx.pipeline.executar(job.id);

    const final = await carregarJob(job.id);
    expect(final).toMatchObject({ status: 'concluido', tentativas: 2 });
    const chunksDepois = await ctx.db.select().from(chunks).where(eq(chunks.jobId, job.id)).orderBy(asc(chunks.ordem));
    expect(chunksDepois.map((c) => c.id)).toEqual(chunksAntes.map((c) => c.id));
    expect(await ctx.db.select().from(cards).where(eq(cards.jobId, job.id))).toHaveLength(final.cardsGerados);

    const ingestoes = ctx.publicador.doJob(job.id).filter((e) => e.status === 'ingerindo');
    expect(ingestoes).toHaveLength(1);
  });

  it('retry da geração substitui os cards anteriores sem duplicar', async () => {
    await iniciar();
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado() });
    await ctx.pipeline.executar(job.id);
    const primeira = await ctx.db.select().from(cards).where(eq(cards.jobId, job.id));

    await ctx.db
      .update(jobs)
      .set({ status: 'gerando', estagioConcluido: 'ingestao', finishedAt: null, cardsGerados: 0, cardsReservados: primeira.length })
      .where(eq(jobs.id, job.id));
    await ctx.db.update(quotaPeriods).set({ cardsReservados: primeira.length, cardsConfirmados: 0 });
    await ctx.pipeline.executar(job.id);

    const segunda = await ctx.db.select().from(cards).where(eq(cards.jobId, job.id));
    expect(segunda).toHaveLength(primeira.length);
    expect(new Set(segunda.map((c) => c.id)).size).toBe(segunda.length);
    expect(segunda.some((c) => primeira.some((p) => p.id === c.id))).toBe(false);
  });

  it('falha definitiva na 4ª tentativa: falhou, reserva liberada, sem relançar', async () => {
    const provider = new ProviderQueFalha(Number.POSITIVE_INFINITY);
    await iniciar(provider);
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado(), estimativa: 30 });

    for (let i = 1; i <= 3; i++) {
      await expect(ctx.pipeline.executar(job.id)).rejects.toThrow(/LLM indisponível/);
      expect((await carregarJob(job.id)).status).toBe('gerando');
    }
    await expect(ctx.pipeline.executar(job.id)).resolves.toBeUndefined();

    const final = await carregarJob(job.id);
    expect(final).toMatchObject({
      status: 'falhou',
      erro: 'Falha ao processar. Tente novamente.',
      tentativas: 4,
      cardsReservados: 0,
    });
    expect(final.finishedAt).toBeInstanceOf(Date);
    expect(await consultarCota(ctx.db, job.userId as string)).toMatchObject({ reservados: 0, confirmados: 0 });
    expect(ctx.publicador.doJob(job.id).at(-1)).toMatchObject({ status: 'falhou', percentual: 100 });
  });
});

describe('PipelineService — orçamento', () => {
  it('orçamento esgotado no meio: status parcial e cota confirmada só pelo gerado', async () => {
    const provider = new ProviderCobrado({ modelo: 'claude-sonnet-5-5' });
    await iniciar(provider);
    const job = await criarJobTeste(ctx, {
      tipo: 'texto',
      conteudo: textoEsparso(40),
      estimativa: 30,
      orcamentoCentavos: ORCAMENTO_PARCIAL,
    });

    await ctx.pipeline.executar(job.id);

    const final = await carregarJob(job.id);
    expect(final.status).toBe('parcial');
    expect(final.cardsGerados).toBeGreaterThan(0);
    expect(final.cardsGerados).toBeLessThan(30);
    // A reserva usa a saída estimada: chamadas já em voo podem passar do teto, até ~1 chamada por vaga de concorrência.
    expect(final.custoCentavos).toBeLessThanOrEqual(ORCAMENTO_PARCIAL * 1.15);
    expect(final.erro).toBeNull();

    const cota = await consultarCota(ctx.db, job.userId as string);
    expect(cota).toMatchObject({ confirmados: final.cardsGerados, reservados: 0 });
    expect(ctx.publicador.doJob(job.id).at(-1)).toMatchObject({ status: 'parcial', percentual: 100 });
  });

  it('retry que pula a geração decide "parcial" pelo custo >= 98% do orçamento', async () => {
    await iniciar();
    const parcial = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado() });
    const cheio = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado() });
    await ctx.pipeline.executar(parcial.id);
    await ctx.pipeline.executar(cheio.id);

    for (const [alvo, custo] of [
      [parcial.id, 9.9],
      [cheio.id, 5],
    ] as const) {
      await ctx.db
        .update(jobs)
        .set({ status: 'gerando', estagioConcluido: 'geracao', finishedAt: null, orcamentoCentavos: 10, custoCentavos: custo })
        .where(eq(jobs.id, alvo));
      await ctx.pipeline.executar(alvo);
    }

    expect((await carregarJob(parcial.id)).status).toBe('parcial');
    expect((await carregarJob(cheio.id)).status).toBe('concluido');
  });
});

describe('PipelineService — idempotência', () => {
  it('job já concluído é no-op', async () => {
    await iniciar();
    const job = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado() });
    await ctx.db.update(jobs).set({ status: 'concluido' }).where(eq(jobs.id, job.id));

    await ctx.pipeline.executar(job.id);

    const depois = await carregarJob(job.id);
    expect(depois).toMatchObject({ status: 'concluido', tentativas: 0, estagioConcluido: null });
    expect(ctx.publicador.eventos).toHaveLength(0);
    expect(await ctx.db.select().from(chunks).where(eq(chunks.jobId, job.id))).toHaveLength(0);
  });

  it('job inexistente ou jobId inválido é no-op', async () => {
    await iniciar();
    await expect(ctx.pipeline.executar('00000000-0000-4000-8000-000000000000')).resolves.toBeUndefined();
    await expect(ctx.pipeline.executar('nao-e-uuid')).resolves.toBeUndefined();
    expect(ctx.publicador.eventos).toHaveLength(0);
  });
});

describe('PipelineService — varredura de zumbis', () => {
  it('marca como falhou jobs não finais com mais de 45 min e libera a reserva', async () => {
    await iniciar();
    const zumbi = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado(), estimativa: 30 });
    const recente = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado(), estimativa: 30 });
    const antigoConcluido = await criarJobTeste(ctx, { tipo: 'texto', conteudo: textoColado() });
    const haMinutos = (min: number) => new Date(Date.now() - min * 60_000);
    await ctx.db.update(jobs).set({ createdAt: haMinutos(50), status: 'gerando' }).where(eq(jobs.id, zumbi.id));
    await ctx.db.update(jobs).set({ createdAt: haMinutos(10) }).where(eq(jobs.id, recente.id));
    await ctx.db
      .update(jobs)
      .set({ createdAt: haMinutos(120), status: 'concluido' })
      .where(eq(jobs.id, antigoConcluido.id));

    expect(await ctx.pipeline.varrerZumbis()).toBe(1);

    const varrido = await carregarJob(zumbi.id);
    expect(varrido.status).toBe('falhou');
    expect(varrido.erro).toBeTruthy();
    expect(varrido.finishedAt).toBeInstanceOf(Date);
    expect(varrido.cardsReservados).toBe(0);
    expect(await consultarCota(ctx.db, zumbi.userId as string)).toMatchObject({ reservados: 0 });
    expect((await carregarJob(recente.id)).status).toBe('pendente');
    expect((await carregarJob(recente.id)).cardsReservados).toBeGreaterThan(0);
    expect((await carregarJob(antigoConcluido.id)).status).toBe('concluido');
    expect(ctx.publicador.doJob(zumbi.id).at(-1)).toMatchObject({ status: 'falhou', percentual: 100 });

    expect(await ctx.pipeline.varrerZumbis()).toBe(0);
  });
});

describe('ConsumidorService', () => {
  it('inicia a fila, registra o consumidor com concorrência 2 e encerra tudo no shutdown', async () => {
    await iniciar();
    await ctx.modulo.init();

    expect(ctx.fila.iniciada).toBe(true);
    expect(ctx.fila.processadores).toEqual([{ fila: FILAS.gerarBaralho, concorrencia: 2 }]);

    await ctx.modulo.close();
    expect(ctx.fila.parada).toBe(true);
  });
});
