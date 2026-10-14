import { type Db, cards, eq, llmCalls } from '@cardify/db';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import { REGENERADOR, type RegeneradorCards } from './regenerador';
import { criarCard, criarJob, criarSessaoAnonima, criarUsuario } from './testing/semear';

const PASSADO = new Date('2020-01-01T00:00:00Z');
const CLOZE_OK = 'O coração {{c1::bombeia}} sangue para o corpo todo';

let t: AppTeste;
let db: Db;
let userId: string;
let outroUserId: string;
let jobId: string;

async function linhaDoCard(id: string) {
  const [linha] = await db.select().from(cards).where(eq(cards.id, id));
  return linha;
}

beforeAll(async () => {
  t = await criarAppTeste();
  db = t.banco.db;
});

afterAll(() => t.fechar());

beforeEach(async () => {
  await t.banco.limpar();
  userId = await criarUsuario(db);
  outroUserId = await criarUsuario(db);
  ({ jobId } = await criarJob(db, { userId }));
});

const logado = (usuario = userId): Record<string, string> => ({ 'x-teste-user': usuario });

describe('GET /v1/jobs/:id/cards', () => {
  it('lista em ordem de `ordem`, com paginação e total', async () => {
    const c3 = await criarCard(db, jobId, { ordem: 2, frente: 'Terceiro?' });
    const c1 = await criarCard(db, jobId, { ordem: 0, frente: 'Primeiro?' });
    const c2 = await criarCard(db, jobId, { ordem: 1, frente: 'Segundo?' });

    const res = await t.app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/cards`, headers: logado() });
    expect(res.statusCode).toBe(200);
    expect(res.json().cards.map((c: { id: string }) => c.id)).toEqual([c1.id, c2.id, c3.id]);
    expect(res.json()).toMatchObject({ total: 3, pagina: 1, tamanho: 100 });

    const pagina2 = await t.app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}/cards?pagina=2&tamanho=2`,
      headers: logado(),
    });
    expect(pagina2.json()).toMatchObject({ total: 3, pagina: 2, tamanho: 2 });
    expect(pagina2.json().cards.map((c: { id: string }) => c.id)).toEqual([c3.id]);
  });

  it('recusa tamanho acima de 500', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}/cards?tamanho=501`,
      headers: logado(),
    });
    expect(res.statusCode).toBe(400);
  });

  it('oculta descartados por padrão e os mostra com incluirDescartados=true', async () => {
    const ativo = await criarCard(db, jobId, { ordem: 0 });
    const descartado = await criarCard(db, jobId, { ordem: 1, estado: 'descartado' });

    const padrao = await t.app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/cards`, headers: logado() });
    expect(padrao.json()).toMatchObject({ total: 1 });
    expect(padrao.json().cards.map((c: { id: string }) => c.id)).toEqual([ativo.id]);

    const todos = await t.app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}/cards?incluirDescartados=true`,
      headers: logado(),
    });
    expect(todos.json()).toMatchObject({ total: 2 });
    expect(todos.json().cards.map((c: { id: string }) => c.id)).toEqual([ativo.id, descartado.id]);
  });

  it('dono errado e job inexistente recebem 404 nao_encontrado', async () => {
    await criarCard(db, jobId);
    const outroDono = await t.app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/cards`, headers: logado(outroUserId) });
    expect(outroDono.statusCode).toBe(404);
    expect(outroDono.json()).toEqual({ erro: 'nao_encontrado' });

    const inexistente = await t.app.inject({
      method: 'GET',
      url: '/v1/jobs/00000000-0000-4000-8000-000000000000/cards',
      headers: logado(),
    });
    expect(inexistente.statusCode).toBe(404);
  });

  it('dono anônimo do job lista com 200; sem sessão recebe 401', async () => {
    const anonId = await criarSessaoAnonima(db);
    const { jobId: jobAnonimo } = await criarJob(db, { anonSessionId: anonId });
    await criarCard(db, jobAnonimo);

    const res = await t.app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobAnonimo}/cards`,
      headers: { 'x-teste-anon': anonId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);

    const semSessao = await t.app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/cards` });
    expect(semSessao.statusCode).toBe(401);
  });
});

describe('PATCH /v1/cards/:id', () => {
  it('edita básico: estado vira editado e updatedAt avança', async () => {
    const card = await criarCard(db, jobId, { updatedAt: PASSADO, createdAt: PASSADO });

    const res = await t.app.inject({
      method: 'PATCH',
      url: `/v1/cards/${card.id}`,
      headers: logado(),
      payload: { verso: 'Resposta nova' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: card.id, verso: 'Resposta nova', estado: 'editado', tipo: 'basico' });

    const linha = await linhaDoCard(card.id);
    expect(linha.estado).toBe('editado');
    expect(linha.updatedAt.getTime()).toBeGreaterThan(PASSADO.getTime());
  });

  it('só ordem: não marca edição nem avança updatedAt', async () => {
    const card = await criarCard(db, jobId, { ordem: 0, updatedAt: PASSADO, createdAt: PASSADO });

    const res = await t.app.inject({ method: 'PATCH', url: `/v1/cards/${card.id}`, headers: logado(), payload: { ordem: 7 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: card.id, ordem: 7, estado: 'gerado' });

    const linha = await linhaDoCard(card.id);
    expect(linha.updatedAt.getTime()).toBe(PASSADO.getTime());
  });

  it('aceita cloze válido e deriva a frente da marcação', async () => {
    const card = await criarCard(db, jobId);

    const res = await t.app.inject({
      method: 'PATCH',
      url: `/v1/cards/${card.id}`,
      headers: logado(),
      payload: { tipo: 'cloze', textoCloze: CLOZE_OK },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      tipo: 'cloze',
      textoCloze: CLOZE_OK,
      frente: 'O coração bombeia sangue para o corpo todo',
    });
  });

  it('cloze inválido responde 422 com o motivo', async () => {
    const card = await criarCard(db, jobId);

    const res = await t.app.inject({
      method: 'PATCH',
      url: `/v1/cards/${card.id}`,
      headers: logado(),
      payload: { tipo: 'cloze', textoCloze: 'Texto sem nenhuma oclusão no corpo' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ erro: 'cloze_invalido', motivo: 'sem_oclusao' });
    expect((await linhaDoCard(card.id)).tipo).toBe('basico');
  });

  it('trocar para básico zera textoCloze', async () => {
    const card = await criarCard(db, jobId, { tipo: 'cloze', frente: 'O coração bombeia sangue para o corpo todo', textoCloze: CLOZE_OK });

    const res = await t.app.inject({
      method: 'PATCH',
      url: `/v1/cards/${card.id}`,
      headers: logado(),
      payload: { tipo: 'basico', frente: 'O que o coração faz?', verso: 'Bombeia sangue' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ tipo: 'basico', textoCloze: null, frente: 'O que o coração faz?' });
    expect((await linhaDoCard(card.id)).textoCloze).toBeNull();
  });

  it('editar um card descartado o restaura como editado', async () => {
    const card = await criarCard(db, jobId, { estado: 'descartado' });

    const res = await t.app.inject({
      method: 'PATCH',
      url: `/v1/cards/${card.id}`,
      headers: logado(),
      payload: { verso: 'Voltou' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('editado');
  });

  it('dono errado recebe 404 e o card não muda', async () => {
    const card = await criarCard(db, jobId, { verso: 'Original' });

    const res = await t.app.inject({
      method: 'PATCH',
      url: `/v1/cards/${card.id}`,
      headers: logado(outroUserId),
      payload: { verso: 'Invadido' },
    });
    expect(res.statusCode).toBe(404);
    expect((await linhaDoCard(card.id)).verso).toBe('Original');
  });
});

describe('DELETE /v1/cards/:id', () => {
  it('faz soft delete, mantém a linha e não altera updatedAt', async () => {
    const card = await criarCard(db, jobId, { updatedAt: PASSADO, createdAt: PASSADO });

    const res = await t.app.inject({ method: 'DELETE', url: `/v1/cards/${card.id}`, headers: logado() });
    expect(res.statusCode).toBe(204);

    const linha = await linhaDoCard(card.id);
    expect(linha).toBeDefined();
    expect(linha.estado).toBe('descartado');
    expect(linha.updatedAt.getTime()).toBe(PASSADO.getTime());
  });

  it('é idempotente', async () => {
    const card = await criarCard(db, jobId);
    expect((await t.app.inject({ method: 'DELETE', url: `/v1/cards/${card.id}`, headers: logado() })).statusCode).toBe(204);
    expect((await t.app.inject({ method: 'DELETE', url: `/v1/cards/${card.id}`, headers: logado() })).statusCode).toBe(204);
    expect((await linhaDoCard(card.id)).estado).toBe('descartado');
  });

  it('dono errado recebe 404 e o card continua ativo', async () => {
    const card = await criarCard(db, jobId);
    const res = await t.app.inject({ method: 'DELETE', url: `/v1/cards/${card.id}`, headers: logado(outroUserId) });
    expect(res.statusCode).toBe(404);
    expect((await linhaDoCard(card.id)).estado).toBe('gerado');
  });
});

describe('POST /v1/cards/lote', () => {
  it('descarta e restaura; restaurar volta a editado se updatedAt > createdAt, senão gerado', async () => {
    const gerado = await criarCard(db, jobId, { createdAt: PASSADO, updatedAt: PASSADO });
    const editado = await criarCard(db, jobId, { createdAt: PASSADO });
    const ids = [gerado.id, editado.id];

    const descarte = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids, acao: 'descartar' },
    });
    expect(descarte.statusCode).toBe(200);
    expect(descarte.json()).toEqual({ alterados: 2 });
    expect((await linhaDoCard(gerado.id)).estado).toBe('descartado');

    const restauro = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids, acao: 'restaurar' },
    });
    expect(restauro.json()).toEqual({ alterados: 2 });
    expect((await linhaDoCard(gerado.id)).estado).toBe('gerado');
    expect((await linhaDoCard(editado.id)).estado).toBe('editado');
  });

  it('adiciona tags sem duplicar e conta só os cards alterados', async () => {
    const a = await criarCard(db, jobId, { tags: ['cardio'], updatedAt: PASSADO });
    const b = await criarCard(db, jobId, { tags: ['cardio', 'fisio'] });

    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids: [a.id, b.id], acao: 'adicionarTags', tags: ['fisio', 'exame'] },
    });
    expect(res.json()).toEqual({ alterados: 2 });

    const tagsA = (await linhaDoCard(a.id)).tags;
    expect(tagsA.sort()).toEqual(['cardio', 'exame', 'fisio']);
    expect((await linhaDoCard(a.id)).updatedAt.getTime()).toBeGreaterThan(PASSADO.getTime());
    expect((await linhaDoCard(b.id)).tags.sort()).toEqual(['cardio', 'exame', 'fisio']);

    const sem = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids: [a.id], acao: 'adicionarTags', tags: ['exame'] },
    });
    expect(sem.json()).toEqual({ alterados: 0 });
  });

  it('remove tags', async () => {
    const card = await criarCard(db, jobId, { tags: ['a', 'b', 'c'] });
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids: [card.id], acao: 'removerTags', tags: ['b'] },
    });
    expect(res.json()).toEqual({ alterados: 1 });
    expect((await linhaDoCard(card.id)).tags).toEqual(['a', 'c']);
  });

  it('exige tags nas ações de tag', async () => {
    const card = await criarCard(db, jobId);
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids: [card.id], acao: 'adicionarTags' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('um id de outro dono responde 404 e nada muda', async () => {
    const meu = await criarCard(db, jobId);
    const { jobId: jobAlheio } = await criarJob(db, { userId: outroUserId });
    const alheio = await criarCard(db, jobAlheio);

    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids: [meu.id, alheio.id], acao: 'descartar' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ erro: 'nao_encontrado' });
    expect((await linhaDoCard(meu.id)).estado).toBe('gerado');
    expect((await linhaDoCard(alheio.id)).estado).toBe('gerado');
  });

  it('id inexistente também responde 404 sem alterar nada', async () => {
    const meu = await criarCard(db, jobId);
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/cards/lote',
      headers: logado(),
      payload: { ids: [meu.id, '00000000-0000-4000-8000-000000000000'], acao: 'descartar' },
    });
    expect(res.statusCode).toBe(404);
    expect((await linhaDoCard(meu.id)).estado).toBe('gerado');
  });
});

describe('PUT /v1/jobs/:id/cards/ordem', () => {
  const idsEmOrdem = async () =>
    (await t.app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/cards`, headers: logado() })).json().cards.map(
      (c: { id: string }) => c.id,
    );

  it('reordena o conjunto inteiro sem alterar updatedAt', async () => {
    const a = await criarCard(db, jobId, { ordem: 0, updatedAt: PASSADO, createdAt: PASSADO });
    const b = await criarCard(db, jobId, { ordem: 1, updatedAt: PASSADO, createdAt: PASSADO });
    const c = await criarCard(db, jobId, { ordem: 2, updatedAt: PASSADO, createdAt: PASSADO });

    const res = await t.app.inject({
      method: 'PUT',
      url: `/v1/jobs/${jobId}/cards/ordem`,
      headers: logado(),
      payload: { ids: [c.id, a.id, b.id] },
    });
    expect(res.statusCode).toBe(204);
    expect(await idsEmOrdem()).toEqual([c.id, a.id, b.id]);
    expect((await linhaDoCard(a.id)).updatedAt.getTime()).toBe(PASSADO.getTime());
  });

  it('reordenação parcial: listados vêm primeiro e os demais mantêm a ordem relativa', async () => {
    const a = await criarCard(db, jobId, { ordem: 0 });
    const b = await criarCard(db, jobId, { ordem: 1 });
    const c = await criarCard(db, jobId, { ordem: 2 });
    const d = await criarCard(db, jobId, { ordem: 3 });

    await t.app.inject({
      method: 'PUT',
      url: `/v1/jobs/${jobId}/cards/ordem`,
      headers: logado(),
      payload: { ids: [d.id, b.id] },
    });
    expect(await idsEmOrdem()).toEqual([d.id, b.id, a.id, c.id]);
    expect((await linhaDoCard(d.id)).ordem).toBe(0);
    expect((await linhaDoCard(b.id)).ordem).toBe(1);
  });

  it('id de outro job, ou repetido, responde 422', async () => {
    const a = await criarCard(db, jobId, { ordem: 0 });
    const { jobId: outroJob } = await criarJob(db, { userId });
    const alheio = await criarCard(db, outroJob);

    const alheioRes = await t.app.inject({
      method: 'PUT',
      url: `/v1/jobs/${jobId}/cards/ordem`,
      headers: logado(),
      payload: { ids: [a.id, alheio.id] },
    });
    expect(alheioRes.statusCode).toBe(422);

    const repetidoRes = await t.app.inject({
      method: 'PUT',
      url: `/v1/jobs/${jobId}/cards/ordem`,
      headers: logado(),
      payload: { ids: [a.id, a.id] },
    });
    expect(repetidoRes.statusCode).toBe(422);
  });

  it('dono errado do job recebe 404', async () => {
    const a = await criarCard(db, jobId);
    const res = await t.app.inject({
      method: 'PUT',
      url: `/v1/jobs/${jobId}/cards/ordem`,
      headers: logado(outroUserId),
      payload: { ids: [a.id] },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /v1/cards/:id/regenerate', () => {
  it('regenera pelo LLM configurado (fake em teste) e registra o custo no ledger', async () => {
    const antigo = await criarCard(db, jobId, {
      frente: 'Qual é o marca-passo fisiológico do coração?',
      verso: 'O nó sinoatrial, localizado no átrio direito.',
    });
    const res = await t.app.inject({ method: 'POST', url: `/v1/cards/${antigo.id}/regenerate`, headers: logado() });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).not.toBe(antigo.id);
    expect((await linhaDoCard(antigo.id)).estado).toBe('descartado');
    const chamadas = await db.select().from(llmCalls).where(eq(llmCalls.jobId, jobId));
    expect(chamadas.map((c) => c.estagio)).toContain('regeneracao');
  });

  it('job anônimo não regenera (exige login)', async () => {
    const anon = await criarSessaoAnonima(db);
    const { jobId: jobAnonimo } = await criarJob(db, { anonSessionId: anon });
    const card = await criarCard(db, jobAnonimo);
    const res = await t.app.inject({ method: 'POST', url: `/v1/cards/${card.id}/regenerate`, headers: { 'x-teste-anon': anon } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ erro: 'login_necessario' });
    expect((await linhaDoCard(card.id)).estado).toBe('gerado');
  });

  describe('com regenerador fake', () => {
    let tComFake: AppTeste;

    beforeAll(async () => {
      const fake: RegeneradorCards = {
        async regenerar() {
          return { tipo: 'basico', frente: 'Pergunta regenerada?', verso: 'Resposta regenerada', textoCloze: null };
        },
      };
      tComFake = await criarAppTeste((builder) => builder.overrideProvider(REGENERADOR).useValue(fake));
    });

    afterAll(() => tComFake.fechar());

    it('cria card novo com o mesmo lugar no baralho e descarta o antigo', async () => {
      const bancoFake = tComFake.banco.db;
      await tComFake.banco.limpar();
      const dono = await criarUsuario(bancoFake);
      const { jobId: jobDoFake } = await criarJob(bancoFake, { userId: dono });
      const tags = ['cardio'];
      const trilhaTitulos = ['Fisiologia', 'Cardiovascular'];
      const antigo = await criarCard(bancoFake, jobDoFake, { ordem: 4, tags, trilhaTitulos, fonteOffset: 12 });

      const res = await tComFake.app.inject({
        method: 'POST',
        url: `/v1/cards/${antigo.id}/regenerate`,
        headers: { 'x-teste-user': dono },
      });
      expect(res.statusCode).toBe(201);
      const novo = res.json();
      expect(novo.id).not.toBe(antigo.id);
      expect(novo).toMatchObject({
        jobId: jobDoFake,
        frente: 'Pergunta regenerada?',
        verso: 'Resposta regenerada',
        tipo: 'basico',
        estado: 'gerado',
        ordem: 4,
        tags,
        trilhaTitulos,
        fonteOffset: 12,
      });

      const [linhaNova] = await bancoFake.select().from(cards).where(eq(cards.id, novo.id));
      expect(linhaNova.substituiCardId).toBe(antigo.id);
      const [linhaAntiga] = await bancoFake.select().from(cards).where(eq(cards.id, antigo.id));
      expect(linhaAntiga.estado).toBe('descartado');
    });

    it('card já descartado não pode ser regenerado (409)', async () => {
      const bancoFake = tComFake.banco.db;
      const dono = await criarUsuario(bancoFake);
      const { jobId: jobDoFake } = await criarJob(bancoFake, { userId: dono });
      const descartado = await criarCard(bancoFake, jobDoFake, { estado: 'descartado' });

      const res = await tComFake.app.inject({
        method: 'POST',
        url: `/v1/cards/${descartado.id}/regenerate`,
        headers: { 'x-teste-user': dono },
      });
      expect(res.statusCode).toBe(409);
    });
  });
});
