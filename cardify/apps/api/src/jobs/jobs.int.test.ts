import { documents, eq, jobs, quotaPeriods } from '@cardify/db';
import { FILAS, LIMITES_ANONIMO } from '@cardify/shared';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import {
  comoAnonimo,
  comoUsuario,
  criarSessaoAnonima,
  criarUsuario,
  inserirJobDireto,
  lerFixturePdf,
  PARAMETROS,
  textoDeEstudo,
} from './helpers-teste';
import { sha256Hex } from './util';

describe('jobs', () => {
  let t: AppTeste;

  beforeAll(async () => {
    t = await criarAppTeste();
  });
  afterAll(() => t.fechar());
  beforeEach(async () => {
    await t.banco.limpar();
    t.fila.enviados.length = 0;
  });

  const postJob = (headers: Record<string, string>, corpo: object) =>
    t.app.inject({ method: 'POST', url: '/v1/jobs', headers, payload: corpo });
  const todosJobs = () => t.banco.db.select().from(jobs);
  const periodos = () => t.banco.db.select().from(quotaPeriods);

  describe('POST /v1/jobs com texto (logado)', () => {
    it('responde 202, cria job pendente, reserva cota e enfileira com singletonKey', async () => {
      const userId = await criarUsuario(t);
      const texto = textoDeEstudo(3);

      const res = await postJob(comoUsuario(userId), { texto, nome: 'Fisio', parametros: PARAMETROS });

      expect(res.statusCode).toBe(202);
      const resumo = res.json();
      expect(resumo).toMatchObject({ status: 'pendente', cardsGerados: 0, custoCentavos: 0, erro: null, nome: 'Fisio', finishedAt: null });

      const [job] = await todosJobs();
      const [doc] = await t.banco.db.select().from(documents);
      expect(job).toMatchObject({
        id: resumo.id,
        userId,
        anonSessionId: null,
        documentId: doc.id,
        amostra: false,
        cardsReservados: 6,
        orcamentoCentavos: 30,
        params: PARAMETROS,
      });
      expect(doc).toMatchObject({ tipo: 'texto', status: 'enviado', sha256: sha256Hex(texto), nome: 'Fisio', userId });
      expect((await t.storage.ler(doc.storageKey)).toString('utf8')).toBe(texto);

      const [periodo] = await periodos();
      expect(periodo.cardsReservados).toBe(6);

      expect(t.fila.enviados).toHaveLength(1);
      expect(t.fila.enviados[0]).toMatchObject({
        fila: FILAS.gerarBaralho,
        payload: { jobId: resumo.id },
        opcoes: { singletonKey: job.idempotencyKey },
      });
      expect(job.idempotencyKey).toBeTruthy();
    });

    it('nome padrão "Texto colado" e orçamento proporcional ao reservado', async () => {
      const userId = await criarUsuario(t);
      await postJob(comoUsuario(userId), { texto: textoDeEstudo(20), parametros: { ...PARAMETROS, densidade: 'exaustivo' } });
      const [job] = await todosJobs();
      expect(job.nome).toBe('Texto colado');
      expect(job.cardsReservados).toBe(30);
      expect(job.orcamentoCentavos).toBe(36);
    });

    it('amostra limita a estimativa a 10 cards', async () => {
      const userId = await criarUsuario(t);
      await postJob(comoUsuario(userId), { texto: textoDeEstudo(20), parametros: PARAMETROS, amostra: true });
      const [job] = await todosJobs();
      expect(job).toMatchObject({ amostra: true, cardsReservados: 10 });
    });

    it('valida o corpo e exige sessão', async () => {
      const userId = await criarUsuario(t);
      const invalido = await postJob(comoUsuario(userId), { texto: 'curto', parametros: PARAMETROS });
      expect(invalido.statusCode).toBe(400);
      expect((await postJob({}, { texto: textoDeEstudo(1), parametros: PARAMETROS })).statusCode).toBe(401);
      expect(await todosJobs()).toHaveLength(0);
    });
  });

  describe('POST /v1/jobs com documentId', () => {
    async function documentoEnviado(userId: string, status: 'enviado' | 'aguardando_upload' = 'enviado') {
      const pdf = lerFixturePdf('slides.pdf');
      const [doc] = await t.banco.db
        .insert(documents)
        .values({
          userId,
          tipo: 'pdf',
          sha256: sha256Hex(pdf),
          nome: 'slides.pdf',
          bytes: pdf.length,
          storageKey: `docs/u-${userId}/x/original`,
          status,
          expiresAt: new Date(Date.now() + 86_400_000),
        })
        .returning();
      return doc;
    }

    it('cria o job sobre o documento enviado e estima pelos bytes do PDF', async () => {
      const userId = await criarUsuario(t);
      const doc = await documentoEnviado(userId);

      const res = await postJob(comoUsuario(userId), { documentId: doc.id, parametros: PARAMETROS });

      expect(res.statusCode).toBe(202);
      const [job] = await todosJobs();
      expect(job).toMatchObject({ documentId: doc.id, nome: 'slides.pdf' });
      expect(job.cardsReservados).toBe(Math.min(30, Math.ceil(doc.bytes! / 600) * 2));
      expect(await t.banco.db.select().from(documents)).toHaveLength(1);
    });

    it('409 se o upload não foi concluído; 404 se for de outro dono ou inexistente', async () => {
      const userId = await criarUsuario(t);
      const outro = await criarUsuario(t, 'bia@exemplo.com');
      const pendente = await documentoEnviado(userId, 'aguardando_upload');
      const alheio = await documentoEnviado(outro);

      const r409 = await postJob(comoUsuario(userId), { documentId: pendente.id, parametros: PARAMETROS });
      expect(r409.statusCode).toBe(409);
      expect(r409.json().erro).toBe('documento_nao_enviado');
      expect((await postJob(comoUsuario(userId), { documentId: alheio.id, parametros: PARAMETROS })).statusCode).toBe(404);
      expect(
        (await postJob(comoUsuario(userId), { documentId: '00000000-0000-4000-8000-000000000000', parametros: PARAMETROS }))
          .statusCode,
      ).toBe(404);
      expect(await todosJobs()).toHaveLength(0);
      expect(t.fila.enviados).toHaveLength(0);
    });
  });

  describe('idempotência', () => {
    const corpo = () => ({ texto: textoDeEstudo(2), parametros: PARAMETROS });

    it('mesma requisição duas vezes: mesmo job, um envio, sem novo documento nem reserva extra', async () => {
      const userId = await criarUsuario(t);
      const a = await postJob(comoUsuario(userId), corpo());
      const b = await postJob(comoUsuario(userId), corpo());

      expect(a.statusCode).toBe(202);
      expect(b.statusCode).toBe(202);
      expect(b.json().id).toBe(a.json().id);
      expect(t.fila.enviados).toHaveLength(1);
      expect(await todosJobs()).toHaveLength(1);
      expect(await t.banco.db.select().from(documents)).toHaveLength(1);
      expect((await periodos())[0].cardsReservados).toBe(4);
    });

    it('parâmetros diferentes geram outro job', async () => {
      const userId = await criarUsuario(t);
      const a = await postJob(comoUsuario(userId), corpo());
      const b = await postJob(comoUsuario(userId), {
        ...corpo(),
        parametros: { ...PARAMETROS, densidade: 'enxuto' },
      });
      expect(b.json().id).not.toBe(a.json().id);
      expect(t.fila.enviados).toHaveLength(2);
    });

    it('a ordem das chaves dos parâmetros não muda o hash', async () => {
      const userId = await criarUsuario(t);
      const a = await postJob(comoUsuario(userId), corpo());
      const b = await postJob(comoUsuario(userId), {
        texto: corpo().texto,
        parametros: { area: 'geral', tipo: 'misto', densidade: 'equilibrado' },
      });
      expect(b.json().id).toBe(a.json().id);
    });

    it('Idempotency-Key: repete devolve o mesmo, outra chave cria novo job', async () => {
      const userId = await criarUsuario(t);
      const h = (k: string) => ({ ...comoUsuario(userId), 'idempotency-key': k });
      const a = await postJob(h('k1'), corpo());
      const repetido = await postJob(h('k1'), corpo());
      const outra = await postJob(h('k2'), corpo());

      expect(repetido.json().id).toBe(a.json().id);
      expect(outra.json().id).not.toBe(a.json().id);
      expect(t.fila.enviados).toHaveLength(2);
    });

    it('Idempotency-Key é escopada ao dono e limitada a 200 caracteres', async () => {
      const userId = await criarUsuario(t);
      const outro = await criarUsuario(t, 'bia@exemplo.com');
      const a = await postJob({ ...comoUsuario(userId), 'idempotency-key': 'k1' }, corpo());
      const b = await postJob({ ...comoUsuario(outro), 'idempotency-key': 'k1' }, corpo());
      expect(b.statusCode).toBe(202);
      expect(b.json().id).not.toBe(a.json().id);

      const longa = await postJob({ ...comoUsuario(userId), 'idempotency-key': 'x'.repeat(201) }, corpo());
      expect(longa.statusCode).toBe(400);
      expect(longa.json().erro).toBe('idempotency_key_invalida');
      expect(
        (await postJob({ ...comoUsuario(userId), 'idempotency-key': 'y'.repeat(200) }, corpo())).statusCode,
      ).toBe(202);
    });

    it('5 requisições simultâneas iguais resultam em um job, um documento e uma reserva', async () => {
      const userId = await criarUsuario(t);
      const respostas = await Promise.all(Array.from({ length: 5 }, () => postJob(comoUsuario(userId), corpo())));

      expect(respostas.map((r) => r.statusCode)).toEqual([202, 202, 202, 202, 202]);
      expect(new Set(respostas.map((r) => r.json().id)).size).toBe(1);
      expect(await todosJobs()).toHaveLength(1);
      expect(await t.banco.db.select().from(documents)).toHaveLength(1);
      expect(t.fila.enviados).toHaveLength(1);
      expect((await periodos())[0].cardsReservados).toBe(4);
    });

    it('5 requisições simultâneas de anônimo também resultam em um job', async () => {
      const anonId = await criarSessaoAnonima(t);
      const respostas = await Promise.all(Array.from({ length: 5 }, () => postJob(comoAnonimo(anonId), corpo())));
      expect(new Set(respostas.map((r) => r.json().id)).size).toBe(1);
      expect(await todosJobs()).toHaveLength(1);
      expect(await t.banco.db.select().from(documents)).toHaveLength(1);
      expect(t.fila.enviados).toHaveLength(1);
    });

    it('job falhou + mesma requisição: cria novo job e zera a chave do antigo', async () => {
      const userId = await criarUsuario(t);
      // FilaEmMemoria dedupa para sempre; o pg-boss só dedupa jobs created/retry/active. Observamos as chamadas.
      const envios = vi.spyOn(t.fila, 'enviar');
      const a = await postJob(comoUsuario(userId), corpo());
      await t.banco.db.update(jobs).set({ status: 'falhou', erro: 'boom' }).where(eq(jobs.id, a.json().id));

      const b = await postJob(comoUsuario(userId), corpo());

      expect(b.statusCode).toBe(202);
      expect(b.json().id).not.toBe(a.json().id);
      expect(b.json().status).toBe('pendente');
      const [antigo] = await t.banco.db.select().from(jobs).where(eq(jobs.id, a.json().id));
      expect(antigo.idempotencyKey).toBeNull();
      expect(envios).toHaveBeenCalledTimes(2);
      expect(envios.mock.calls[1][2]).toEqual(envios.mock.calls[0][2]);
      expect(envios.mock.calls[1][1]).toEqual({ jobId: b.json().id });
      envios.mockRestore();
    });

    it('se o envio à fila falhar, o job vira falhou e a reserva é liberada', async () => {
      const userId = await criarUsuario(t);
      const original = t.fila.enviar.bind(t.fila);
      t.fila.enviar = async () => {
        throw new Error('fila fora do ar');
      };
      try {
        const res = await postJob(comoUsuario(userId), corpo());
        expect(res.statusCode).toBe(500);
      } finally {
        t.fila.enviar = original;
      }
      const [job] = await todosJobs();
      expect(job).toMatchObject({ status: 'falhou', erro: 'falha_ao_enfileirar', cardsReservados: 0 });
      expect((await periodos())[0].cardsReservados).toBe(0);

      const novo = await postJob(comoUsuario(userId), corpo());
      expect(novo.statusCode).toBe(202);
      expect(novo.json().id).not.toBe(job.id);
    });
  });

  describe('cota', () => {
    it('esgotada: 402 cota_excedida sem criar job, documento nem envio', async () => {
      const userId = await criarUsuario(t);
      const primeiro = await postJob(comoUsuario(userId), { texto: textoDeEstudo(20, 'um'), parametros: PARAMETROS });
      expect(primeiro.statusCode).toBe(202);
      expect((await periodos())[0].cardsReservados).toBe(30);

      const res = await postJob(comoUsuario(userId), { texto: textoDeEstudo(5, 'dois'), parametros: PARAMETROS });

      expect(res.statusCode).toBe(402);
      expect(res.json().erro).toBe('cota_excedida');
      expect(await todosJobs()).toHaveLength(1);
      expect(await t.banco.db.select().from(documents)).toHaveLength(1);
      expect(t.fila.enviados).toHaveLength(1);
      expect((await periodos())[0].cardsReservados).toBe(30);
    });

    it('reserva parcial quando resta pouco', async () => {
      const userId = await criarUsuario(t);
      await postJob(comoUsuario(userId), { texto: textoDeEstudo(10, 'um'), parametros: PARAMETROS });
      const res = await postJob(comoUsuario(userId), { texto: textoDeEstudo(10, 'dois'), parametros: PARAMETROS });

      expect(res.statusCode).toBe(202);
      const reservas = (await todosJobs()).map((j) => j.cardsReservados).sort((a, b) => a - b);
      expect(reservas).toEqual([10, 20]);
      expect((await periodos())[0].cardsReservados).toBe(30);
    });

    it('GET /v1/cota devolve a cota do usuário grátis', async () => {
      const userId = await criarUsuario(t);
      await postJob(comoUsuario(userId), { texto: textoDeEstudo(5), parametros: PARAMETROS });

      const res = await t.app.inject({ method: 'GET', url: '/v1/cota', headers: comoUsuario(userId) });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ plano: 'gratis', limite: 30, confirmados: 0, reservados: 10, restante: 20 });
      expect(new Date(res.json().periodoFim).getTime()).toBeGreaterThan(Date.now());
    });

    it('GET /v1/cota exige login', async () => {
      const anonId = await criarSessaoAnonima(t);
      expect((await t.app.inject({ method: 'GET', url: '/v1/cota', headers: comoAnonimo(anonId) })).statusCode).toBe(401);
    });
  });

  describe('anônimo', () => {
    it('força amostra, reserva 10 cards fixos e não usa cota', async () => {
      const anonId = await criarSessaoAnonima(t);

      const res = await postJob(comoAnonimo(anonId), {
        texto: textoDeEstudo(20),
        parametros: PARAMETROS,
        amostra: false,
      });

      expect(res.statusCode).toBe(202);
      const [job] = await todosJobs();
      const [doc] = await t.banco.db.select().from(documents);
      expect(job).toMatchObject({
        userId: null,
        anonSessionId: anonId,
        amostra: true,
        cardsReservados: LIMITES_ANONIMO.maxCards,
        orcamentoCentavos: 30,
      });
      expect(doc).toMatchObject({ userId: null, anonSessionId: anonId, tipo: 'texto' });
      expect(doc.storageKey).toBe(`docs/a-${anonId}/${doc.id}/original`);
      expect(await periodos()).toHaveLength(0);
      expect(t.fila.enviados).toHaveLength(1);
    });

    it('outro anônimo e usuário logado recebem 404 no job anônimo', async () => {
      const anonId = await criarSessaoAnonima(t);
      const outroAnon = await criarSessaoAnonima(t);
      const userId = await criarUsuario(t);
      const { id } = (await postJob(comoAnonimo(anonId), { texto: textoDeEstudo(2), parametros: PARAMETROS })).json();

      const ver = (headers: Record<string, string>) => t.app.inject({ method: 'GET', url: `/v1/jobs/${id}`, headers });
      expect((await ver(comoAnonimo(anonId))).statusCode).toBe(200);
      for (const headers of [comoAnonimo(outroAnon), comoUsuario(userId)]) {
        const res = await ver(headers);
        expect(res.statusCode).toBe(404);
        expect(res.json().erro).toBe('nao_encontrado');
      }
    });

    it('não usa documento de outro anônimo', async () => {
      const anonId = await criarSessaoAnonima(t);
      const userId = await criarUsuario(t);
      const [doc] = await t.banco.db
        .insert(documents)
        .values({
          userId,
          tipo: 'pdf',
          sha256: 'abc',
          nome: 'a.pdf',
          bytes: 10,
          storageKey: 'k',
          status: 'enviado',
          expiresAt: new Date(Date.now() + 86_400_000),
        })
        .returning();
      const res = await postJob(comoAnonimo(anonId), { documentId: doc.id, parametros: PARAMETROS });
      expect(res.statusCode).toBe(404);
    });

    it('GET /v1/jobs (listagem) exige login', async () => {
      const anonId = await criarSessaoAnonima(t);
      expect((await t.app.inject({ method: 'GET', url: '/v1/jobs', headers: comoAnonimo(anonId) })).statusCode).toBe(401);
    });
  });

  describe('GET /v1/jobs/:id', () => {
    it('arredonda custoCentavos e serializa datas ISO', async () => {
      const userId = await criarUsuario(t);
      const fim = new Date('2026-05-01T10:00:00.000Z');
      const job = await inserirJobDireto(t, { userId }, {
        status: 'concluido',
        custoCentavos: 12.6,
        cardsGerados: 7,
        nome: 'Aula',
        finishedAt: fim,
      });

      const res = await t.app.inject({ method: 'GET', url: `/v1/jobs/${job.id}`, headers: comoUsuario(userId) });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        id: job.id,
        status: 'concluido',
        cardsGerados: 7,
        custoCentavos: 13,
        erro: null,
        nome: 'Aula',
        createdAt: job.createdAt.toISOString(),
        finishedAt: fim.toISOString(),
      });
    });

    it('404 para job de outro usuário, inexistente ou id malformado', async () => {
      const userId = await criarUsuario(t);
      const outro = await criarUsuario(t, 'bia@exemplo.com');
      const job = await inserirJobDireto(t, { userId });
      for (const id of [job.id, '00000000-0000-4000-8000-000000000000', 'abc']) {
        const res = await t.app.inject({ method: 'GET', url: `/v1/jobs/${id}`, headers: comoUsuario(outro) });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ erro: 'nao_encontrado' });
      }
    });
  });

  describe('GET /v1/jobs', () => {
    it('lista só os jobs do usuário, mais recentes primeiro, até 50', async () => {
      const userId = await criarUsuario(t);
      const outro = await criarUsuario(t, 'bia@exemplo.com');
      const base = Date.parse('2026-01-01T00:00:00Z');
      const criados: string[] = [];
      for (let i = 0; i < 52; i++) {
        const job = await inserirJobDireto(t, { userId }, { createdAt: new Date(base + i * 1000) });
        criados.push(job.id);
      }
      await inserirJobDireto(t, { userId: outro });

      const res = await t.app.inject({ method: 'GET', url: '/v1/jobs', headers: comoUsuario(userId) });

      expect(res.statusCode).toBe(200);
      const lista = res.json();
      expect(lista).toHaveLength(50);
      expect(lista[0].id).toBe(criados[51]);
      expect(lista[49].id).toBe(criados[2]);
    });
  });
});
