import type { ProgressoEvento } from '@cardify/shared';
import type { MessageEvent } from '@nestjs/common';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import { comoAnonimo, comoUsuario, criarSessaoAnonima, criarUsuario, inserirJobDireto } from './helpers-teste';
import { JobsService } from './jobs.service';

describe('progresso (SSE)', () => {
  let t: AppTeste;
  let servico: JobsService;

  beforeAll(async () => {
    t = await criarAppTeste();
    servico = t.app.get(JobsService);
  });
  afterAll(() => t.fechar());
  beforeEach(() => t.banco.limpar());
  afterEach(() => vi.restoreAllMocks());

  const evento = (jobId: string, extra: Partial<ProgressoEvento>): ProgressoEvento => ({
    jobId,
    status: 'gerando',
    estagio: 'geracao',
    percentual: 50,
    cardsGerados: 3,
    ...extra,
  });

  function espionarCancelamentos() {
    const cancelamentos = vi.fn();
    const original = t.progresso.assinar.bind(t.progresso);
    vi.spyOn(t.progresso, 'assinar').mockImplementation(async (jobId, aoReceber) => {
      const cancelar = await original(jobId, aoReceber);
      return async () => {
        cancelamentos();
        await cancelar();
      };
    });
    return cancelamentos;
  }

  function coletar(obs: import('rxjs').Observable<MessageEvent>) {
    const recebidos: ProgressoEvento[] = [];
    const estado = { completou: false, erro: null as unknown };
    const assinatura = obs.subscribe({
      next: (m) => recebidos.push(m.data as ProgressoEvento),
      complete: () => (estado.completou = true),
      error: (e) => (estado.erro = e),
    });
    return { recebidos, estado, assinatura };
  }

  it('emite o estado do banco, repassa eventos e completa no status final', async () => {
    const userId = await criarUsuario(t);
    const job = await inserirJobDireto(t, { userId }, { status: 'ingerindo' });
    const cancelamentos = espionarCancelamentos();
    const dono = { userId, anonSessionId: null };

    const { recebidos, estado } = coletar(await servico.streamProgresso(dono, job.id));
    await vi.waitFor(() => expect(recebidos).toHaveLength(1));
    expect(recebidos[0]).toMatchObject({ jobId: job.id, status: 'ingerindo', estagio: 'ingestao', cardsGerados: 0 });

    t.progresso.emitir(evento(job.id, { cardsGerados: 3 }));
    t.progresso.emitir(evento('00000000-0000-4000-8000-000000000000', { status: 'concluido' }));
    expect(recebidos).toHaveLength(2);
    expect(recebidos[1]).toMatchObject({ status: 'gerando', cardsGerados: 3 });
    expect(estado.completou).toBe(false);
    expect(cancelamentos).not.toHaveBeenCalled();

    t.progresso.emitir(evento(job.id, { status: 'parcial', estagio: 'empacotamento', percentual: 100 }));
    expect(recebidos).toHaveLength(3);
    expect(estado.completou).toBe(true);
    expect(cancelamentos).toHaveBeenCalledTimes(1);

    t.progresso.emitir(evento(job.id, { cardsGerados: 9 }));
    expect(recebidos).toHaveLength(3);
  });

  it('job já em status final: emite o estado e completa', async () => {
    const userId = await criarUsuario(t);
    const job = await inserirJobDireto(t, { userId }, { status: 'concluido', cardsGerados: 10, estagioConcluido: 'empacotamento' });
    const cancelamentos = espionarCancelamentos();

    const { recebidos, estado } = coletar(await servico.streamProgresso({ userId, anonSessionId: null }, job.id));

    await vi.waitFor(() => expect(estado.completou).toBe(true));
    expect(recebidos).toEqual([
      { jobId: job.id, status: 'concluido', estagio: 'empacotamento', percentual: 100, cardsGerados: 10 },
    ]);
    expect(cancelamentos).toHaveBeenCalledTimes(1);
  });

  it('job falhou inclui a mensagem de erro', async () => {
    const userId = await criarUsuario(t);
    const job = await inserirJobDireto(t, { userId }, { status: 'falhou', erro: 'documento_escaneado' });
    const { recebidos, estado } = coletar(await servico.streamProgresso({ userId, anonSessionId: null }, job.id));
    await vi.waitFor(() => expect(estado.completou).toBe(true));
    expect(recebidos[0]).toMatchObject({ status: 'falhou', mensagem: 'documento_escaneado' });
  });

  it('cancelar a inscrição (cliente desconectou) cancela a assinatura de progresso', async () => {
    const userId = await criarUsuario(t);
    const job = await inserirJobDireto(t, { userId }, { status: 'gerando' });
    const cancelamentos = espionarCancelamentos();

    const { recebidos, assinatura } = coletar(await servico.streamProgresso({ userId, anonSessionId: null }, job.id));
    await vi.waitFor(() => expect(recebidos).toHaveLength(1));
    assinatura.unsubscribe();

    expect(cancelamentos).toHaveBeenCalledTimes(1);
    t.progresso.emitir(evento(job.id, {}));
    expect(recebidos).toHaveLength(1);
  });

  it('desconectar antes da assinatura terminar também não deixa assinatura pendurada', async () => {
    const userId = await criarUsuario(t);
    const job = await inserirJobDireto(t, { userId }, { status: 'gerando' });
    const cancelamentos = espionarCancelamentos();

    const { assinatura } = coletar(await servico.streamProgresso({ userId, anonSessionId: null }, job.id));
    assinatura.unsubscribe();

    await vi.waitFor(() => expect(cancelamentos).toHaveBeenCalledTimes(1));
  });

  it('só o dono acompanha o job: 404 para outros', async () => {
    const userId = await criarUsuario(t);
    const outro = await criarUsuario(t, 'bia@exemplo.com');
    const anonId = await criarSessaoAnonima(t);
    const job = await inserirJobDireto(t, { userId });

    await expect(servico.streamProgresso({ userId: outro, anonSessionId: null }, job.id)).rejects.toMatchObject({ status: 404 });
    await expect(servico.streamProgresso({ userId: null, anonSessionId: anonId }, job.id)).rejects.toMatchObject({ status: 404 });
  });

  // app.inject não serve SSE (o socket simulado não tem setKeepAlive): estes testes usam HTTP real.
  describe('GET /v1/jobs/:id/events', () => {
    let base: string;

    beforeAll(async () => {
      await t.app.listen(0, '127.0.0.1');
      base = (await t.app.getUrl()).replace('[::1]', '127.0.0.1');
    });

    it('job concluído: o stream emite o estado e fecha', async () => {
      const userId = await criarUsuario(t);
      const job = await inserirJobDireto(t, { userId }, { status: 'concluido', cardsGerados: 4, estagioConcluido: 'empacotamento' });

      const res = await fetch(`${base}/v1/jobs/${job.id}/events`, { headers: comoUsuario(userId) });
      const corpo = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const linhas = corpo.split('\n').filter((l) => l.startsWith('data:'));
      expect(linhas).toHaveLength(1);
      expect(JSON.parse(linhas[0].slice(5))).toMatchObject({ jobId: job.id, status: 'concluido', percentual: 100, cardsGerados: 4 });
    });

    it('job em andamento: repassa eventos do worker e fecha no status final', async () => {
      const userId = await criarUsuario(t);
      const job = await inserirJobDireto(t, { userId }, { status: 'gerando' });
      const cancelamentos = espionarCancelamentos();

      const res = await fetch(`${base}/v1/jobs/${job.id}/events`, { headers: comoUsuario(userId) });
      const leitor = res.body!.getReader();
      const decoder = new TextDecoder();
      let acumulado = '';
      const lerAte = async (trecho: string) => {
        while (!acumulado.includes(trecho)) {
          const { done, value } = await leitor.read();
          if (done) return false;
          acumulado += decoder.decode(value);
        }
        return true;
      };

      expect(await lerAte('"status":"gerando"')).toBe(true);
      t.progresso.emitir(evento(job.id, { status: 'concluido', estagio: 'empacotamento', percentual: 100, cardsGerados: 9 }));
      expect(await lerAte('"status":"concluido"')).toBe(true);
      expect((await leitor.read()).done).toBe(true);
      await vi.waitFor(() => expect(cancelamentos).toHaveBeenCalledTimes(1));
    });

    it('anônimo acompanha o próprio job; 404 para outro dono e 401 sem sessão', async () => {
      const anonId = await criarSessaoAnonima(t);
      const outroAnon = await criarSessaoAnonima(t);
      const job = await inserirJobDireto(t, { anonSessionId: anonId }, { status: 'parcial' });
      const url = `${base}/v1/jobs/${job.id}/events`;

      const proprio = await fetch(url, { headers: comoAnonimo(anonId) });
      expect(proprio.status).toBe(200);
      await proprio.text();
      const alheio = await fetch(url, { headers: comoAnonimo(outroAnon) });
      expect(alheio.status).toBe(404);
      expect(await alheio.json()).toMatchObject({ erro: 'nao_encontrado' });
      expect((await fetch(url)).status).toBe(401);
    });
  });
});
