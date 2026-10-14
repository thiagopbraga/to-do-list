import { createHmac } from 'node:crypto';
import { consultarCota, confirmarCota, eq, quotaPeriods, subscriptions, users, webhookEvents } from '@cardify/db';
import { carregarEnv } from '@cardify/shared';
import { ENV } from '../infra/tokens';
import { comoUsuario, criarUsuario, inserirJobDireto } from '../jobs/helpers-teste';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import { AsaasPagamentoProvider } from './asaas-pagamento.provider';
import { somarMeses } from './datas';
import { FakePagamentoProvider } from './fake-pagamento.provider';
import { PAGAMENTO_PROVIDER } from './tokens';

const CPF = '529.982.247-25';
const CPF_NORMALIZADO = '52998224725';
const DIA = 86_400_000;

describe('pagamento (provider fake)', () => {
  let t: AppTeste;
  let fake: FakePagamentoProvider;

  beforeAll(async () => {
    t = await criarAppTeste((b) =>
      b.overrideProvider(ENV).useValue(carregarEnv({ NODE_ENV: 'test', PAGAMENTO_PROVIDER: 'fake' })),
    );
    fake = t.app.get(PAGAMENTO_PROVIDER);
  });
  afterAll(() => t.fechar());
  beforeEach(() => t.banco.limpar());

  const assinar = (userId: string, corpo: object = { plano: 'essencial', metodo: 'pix', cpfCnpj: CPF }) =>
    t.app.inject({ method: 'POST', url: '/v1/assinaturas', headers: comoUsuario(userId), payload: corpo });
  const obter = (userId: string) =>
    t.app.inject({ method: 'GET', url: '/v1/assinatura', headers: comoUsuario(userId) });
  const cancelar = (userId: string) =>
    t.app.inject({ method: 'DELETE', url: '/v1/assinatura', headers: comoUsuario(userId) });
  const webhook = (rawBody: Buffer | string, headers: Record<string, string>) =>
    t.app.inject({
      method: 'POST',
      url: '/v1/webhooks/pagamento',
      headers: { 'content-type': 'application/json', ...headers },
      payload: rawBody,
    });
  const enviarEvento = (providerSubId: string, tipo: Parameters<FakePagamentoProvider['gerarEvento']>[1], eventId?: string) => {
    const { rawBody, headers } = fake.gerarEvento(providerSubId, tipo, eventId);
    return webhook(rawBody, headers);
  };
  const assinaturaDe = async (userId: string) => {
    const [linha] = await t.banco.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return linha;
  };
  const ativar = async (userId: string, corpo?: object) => {
    const res = await assinar(userId, corpo);
    expect(res.statusCode).toBe(201);
    const { providerSubId } = res.json();
    expect((await enviarEvento(providerSubId, 'pagamento_confirmado')).statusCode).toBe(200);
    return providerSubId as string;
  };

  describe('POST /v1/assinaturas', () => {
    it('Pix: 201 com copia-e-cola e QR Code, assinatura pendente e dados do cliente guardados', async () => {
      const userId = await criarUsuario(t);
      const res = await assinar(userId);

      expect(res.statusCode).toBe(201);
      const corpo = res.json();
      expect(corpo).toMatchObject({ status: 'pendente' });
      expect(corpo.providerSubId).toMatch(/^fake_sub_/);
      expect(corpo.providerCustomerId).toMatch(/^fake_cus_/);
      expect(corpo.pixCopiaECola).toMatch(/^00020126FAKE/);
      expect(Buffer.from(corpo.pixQrCodeBase64, 'base64').subarray(1, 4).toString()).toBe('PNG');
      expect(corpo.urlPagamento).toBeUndefined();

      expect(await assinaturaDe(userId)).toMatchObject({
        plano: 'essencial',
        status: 'pendente',
        providerSubId: corpo.providerSubId,
        periodoInicio: null,
        periodoFim: null,
      });
      const [usuario] = await t.banco.db.select().from(users).where(eq(users.id, userId));
      expect(usuario).toMatchObject({ providerCustomerId: corpo.providerCustomerId, cpfCnpj: CPF_NORMALIZADO });
    });

    it('cartão e boleto devolvem urlPagamento', async () => {
      for (const metodo of ['cartao', 'boleto']) {
        await t.banco.limpar();
        const userId = await criarUsuario(t);
        const res = await assinar(userId, { plano: 'ilimitado', metodo, cpfCnpj: '11.222.333/0001-81' });
        expect(res.statusCode).toBe(201);
        expect(res.json().urlPagamento).toMatch(/^https:\/\//);
        expect(res.json().pixCopiaECola).toBeUndefined();
        const [usuario] = await t.banco.db.select().from(users).where(eq(users.id, userId));
        expect(usuario.cpfCnpj).toBe('11222333000181');
      }
    });

    it('reaproveita o cliente do provedor em uma nova assinatura', async () => {
      const userId = await criarUsuario(t);
      const primeira = (await assinar(userId)).json();
      const segunda = (await assinar(userId, { plano: 'essencial', metodo: 'boleto', cpfCnpj: CPF })).json();
      expect(segunda.providerCustomerId).toBe(primeira.providerCustomerId);
    });

    it('nova tentativa substitui a assinatura pendente anterior e a cancela no provedor', async () => {
      const userId = await criarUsuario(t);
      const primeira = (await assinar(userId)).json();
      const segunda = (await assinar(userId, { plano: 'anual', metodo: 'cartao', cpfCnpj: CPF })).json();

      const linhas = await t.banco.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
      expect(linhas.map((l) => [l.providerSubId, l.status]).sort()).toEqual(
        [
          [primeira.providerSubId, 'cancelada'],
          [segunda.providerSubId, 'pendente'],
        ].sort(),
      );
      expect(fake.canceladas).toContain(primeira.providerSubId);
      expect((await obter(userId)).json()).toMatchObject({ plano: 'anual', status: 'pendente' });
    });

    it('409 assinatura_ativa quando já existe assinatura ativa (e quando atrasada)', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);

      const res = await assinar(userId);
      expect(res.statusCode).toBe(409);
      expect(res.json().erro).toBe('assinatura_ativa');
      expect(await t.banco.db.select().from(subscriptions)).toHaveLength(1);

      await enviarEvento(providerSubId, 'pagamento_atrasado');
      expect((await assinar(userId)).statusCode).toBe(409);
    });

    it('duas requisições simultâneas criam uma só assinatura', async () => {
      const userId = await criarUsuario(t);
      const [a, b] = await Promise.all([assinar(userId), assinar(userId)]);
      expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
      const linhas = await t.banco.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
      expect(linhas.filter((l) => l.status === 'pendente')).toHaveLength(1);
    });

    it('valida o corpo: plano grátis, método e CPF/CNPJ inválidos viram 400', async () => {
      const userId = await criarUsuario(t);
      for (const corpo of [
        { plano: 'gratis', metodo: 'pix', cpfCnpj: CPF },
        { plano: 'essencial', metodo: 'dinheiro', cpfCnpj: CPF },
        { plano: 'essencial', metodo: 'pix' },
        { plano: 'essencial', metodo: 'pix', cpfCnpj: '123' },
        { plano: 'essencial', metodo: 'pix', cpfCnpj: '5299822472501' },
      ]) {
        const res = await assinar(userId, corpo);
        expect(res.statusCode, JSON.stringify(corpo)).toBe(400);
      }
      expect(await t.banco.db.select().from(subscriptions)).toHaveLength(0);
    });

    it('exige login', async () => {
      const res = await t.app.inject({
        method: 'POST',
        url: '/v1/assinaturas',
        payload: { plano: 'essencial', metodo: 'pix', cpfCnpj: CPF },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /v1/assinatura', () => {
    it('sem assinatura: plano grátis', async () => {
      const userId = await criarUsuario(t);
      const res = await obter(userId);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ plano: 'gratis', status: null, periodoFim: null, pagamentoPendente: null });
    });

    it('pendente: devolve o plano contratado e a cobrança a pagar', async () => {
      const userId = await criarUsuario(t);
      const criada = (await assinar(userId)).json();
      const res = await obter(userId);
      expect(res.json()).toEqual({
        plano: 'essencial',
        status: 'pendente',
        periodoFim: null,
        pagamentoPendente: criada,
      });
    });

    it('pendente por cartão devolve a urlPagamento', async () => {
      const userId = await criarUsuario(t);
      const criada = (await assinar(userId, { plano: 'essencial', metodo: 'cartao', cpfCnpj: CPF })).json();
      expect((await obter(userId)).json().pagamentoPendente).toEqual(criada);
    });

    it('ativa, atrasada e cancelada mantêm o plano até o fim do período', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);
      const { periodoFim } = await assinaturaDe(userId);

      const ativa = (await obter(userId)).json();
      expect(ativa).toEqual({
        plano: 'essencial',
        status: 'ativa',
        periodoFim: periodoFim!.toISOString(),
        pagamentoPendente: null,
      });

      await enviarEvento(providerSubId, 'pagamento_atrasado');
      expect((await obter(userId)).json()).toMatchObject({ plano: 'essencial', status: 'atrasada' });

      expect((await cancelar(userId)).statusCode).toBe(204);
      expect((await obter(userId)).json()).toMatchObject({
        plano: 'essencial',
        status: 'cancelada',
        periodoFim: periodoFim!.toISOString(),
      });
    });

    it('cancelada com o período vencido volta para o plano grátis', async () => {
      const userId = await criarUsuario(t);
      await ativar(userId);
      await cancelar(userId);
      await t.banco.db
        .update(subscriptions)
        .set({ periodoFim: new Date(Date.now() - DIA) })
        .where(eq(subscriptions.userId, userId));

      expect((await obter(userId)).json()).toMatchObject({ plano: 'gratis', status: 'cancelada' });
    });

    it('com assinatura antiga cancelada e uma nova ativa, vale a ativa', async () => {
      const userId = await criarUsuario(t);
      await ativar(userId);
      await cancelar(userId);
      await ativar(userId, { plano: 'ilimitado', metodo: 'pix', cpfCnpj: CPF });
      expect((await obter(userId)).json()).toMatchObject({ plano: 'ilimitado', status: 'ativa' });
    });
  });

  describe('DELETE /v1/assinatura', () => {
    it('cancela no provedor, marca cancelada e mantém o período', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);
      const antes = await assinaturaDe(userId);

      const res = await cancelar(userId);
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect(fake.canceladas).toContain(providerSubId);
      const depois = await assinaturaDe(userId);
      expect(depois.status).toBe('cancelada');
      expect(depois.periodoFim).toEqual(antes.periodoFim);
    });

    it('cancela também uma assinatura pendente', async () => {
      const userId = await criarUsuario(t);
      await assinar(userId);
      expect((await cancelar(userId)).statusCode).toBe(204);
      expect((await assinaturaDe(userId)).status).toBe('cancelada');
    });

    it('404 quando não há assinatura para cancelar', async () => {
      const userId = await criarUsuario(t);
      const res = await cancelar(userId);
      expect(res.statusCode).toBe(404);
      expect(res.json().erro).toBe('assinatura_inexistente');

      await ativar(userId);
      await cancelar(userId);
      expect((await cancelar(userId)).statusCode).toBe(404);
    });

    it('o webhook de cancelamento que o provedor reenvia depois não muda nada', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);
      await cancelar(userId);
      const antes = await assinaturaDe(userId);
      expect((await enviarEvento(providerSubId, 'assinatura_cancelada')).statusCode).toBe(200);
      expect((await assinaturaDe(userId)).periodoFim).toEqual(antes.periodoFim);
    });
  });

  describe('POST /v1/webhooks/pagamento', () => {
    it('assinatura errada, ausente ou de outro segredo: 401 sem efeito', async () => {
      const userId = await criarUsuario(t);
      const { providerSubId } = (await assinar(userId)).json();
      const { rawBody } = fake.gerarEvento(providerSubId, 'pagamento_confirmado');

      expect((await webhook(rawBody, { 'x-fake-assinatura': 'a'.repeat(64) })).statusCode).toBe(401);
      expect((await webhook(rawBody, {})).statusCode).toBe(401);
      const outro = new FakePagamentoProvider('outro-segredo').gerarEvento(providerSubId, 'pagamento_confirmado');
      const res = await webhook(rawBody, outro.headers);
      expect(res.statusCode).toBe(401);
      expect(res.json().erro).toBe('webhook_invalido');

      expect((await assinaturaDe(userId)).status).toBe('pendente');
      expect(await t.banco.db.select().from(webhookEvents)).toHaveLength(0);
    });

    it('a assinatura é verificada sobre o corpo bruto: um byte a mais invalida', async () => {
      const userId = await criarUsuario(t);
      const { providerSubId } = (await assinar(userId)).json();
      const { rawBody, headers } = fake.gerarEvento(providerSubId, 'pagamento_confirmado');

      // Mesmo JSON depois do parse, bytes diferentes: só o corpo bruto distingue.
      const adulterado = Buffer.from(rawBody.toString('utf8').replace('{', '{ '));
      expect(JSON.parse(adulterado.toString())).toEqual(JSON.parse(rawBody.toString()));
      expect((await webhook(adulterado, headers)).statusCode).toBe(401);
      expect((await assinaturaDe(userId)).status).toBe('pendente');

      expect((await webhook(rawBody, headers)).statusCode).toBe(200);
      expect((await assinaturaDe(userId)).status).toBe('ativa');
    });

    it('pagamento confirmado ativa a assinatura mensal por um mês', async () => {
      const userId = await criarUsuario(t);
      const { providerSubId } = (await assinar(userId)).json();
      const antes = Date.now();
      const res = await enviarEvento(providerSubId, 'pagamento_confirmado');

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ recebido: true, resultado: 'processado' });
      const linha = await assinaturaDe(userId);
      expect(linha.status).toBe('ativa');
      expect(linha.periodoInicio!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
      expect(linha.periodoFim).toEqual(somarMeses(linha.periodoInicio!, 1));
    });

    it('plano anual: periodo_fim um ano depois', async () => {
      const userId = await criarUsuario(t);
      await ativar(userId, { plano: 'anual', metodo: 'cartao', cpfCnpj: CPF });
      const linha = await assinaturaDe(userId);
      expect(linha.plano).toBe('anual');
      expect(linha.periodoFim).toEqual(somarMeses(linha.periodoInicio!, 12));
      const dias = (linha.periodoFim!.getTime() - linha.periodoInicio!.getTime()) / DIA;
      expect(dias).toBeGreaterThanOrEqual(365);
      expect(dias).toBeLessThanOrEqual(366);
    });

    it('o mesmo eventId duas vezes produz um único efeito', async () => {
      const userId = await criarUsuario(t);
      const { providerSubId } = (await assinar(userId)).json();
      const { rawBody, headers } = fake.gerarEvento(providerSubId, 'pagamento_confirmado', 'evt_repetido');

      const primeira = await webhook(rawBody, headers);
      const aposPrimeira = await assinaturaDe(userId);
      const segunda = await webhook(rawBody, headers);

      expect(primeira.json().resultado).toBe('processado');
      expect(segunda.statusCode).toBe(200);
      expect(segunda.json()).toEqual({ recebido: true, resultado: 'duplicado' });
      expect(await assinaturaDe(userId)).toEqual(aposPrimeira);
      expect(await t.banco.db.select().from(webhookEvents)).toHaveLength(1);
    });

    it('reenvios simultâneos do mesmo evento são processados uma única vez', async () => {
      const userId = await criarUsuario(t);
      const { providerSubId } = (await assinar(userId)).json();
      const { rawBody, headers } = fake.gerarEvento(providerSubId, 'pagamento_confirmado', 'evt_corrida');
      const respostas = await Promise.all([webhook(rawBody, headers), webhook(rawBody, headers), webhook(rawBody, headers)]);

      expect(respostas.map((r) => r.statusCode)).toEqual([200, 200, 200]);
      expect(respostas.filter((r) => r.json().resultado === 'processado')).toHaveLength(1);
    });

    it('pagamento atrasado marca atrasada, mantendo o período', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);
      const antes = await assinaturaDe(userId);
      await enviarEvento(providerSubId, 'pagamento_atrasado');
      const depois = await assinaturaDe(userId);
      expect(depois.status).toBe('atrasada');
      expect(depois.periodoFim).toEqual(antes.periodoFim);
    });

    it('cobrança inicial vencida não tira a assinatura de pendente', async () => {
      const userId = await criarUsuario(t);
      const { providerSubId } = (await assinar(userId)).json();
      const res = await enviarEvento(providerSubId, 'pagamento_atrasado');
      expect(res.json().resultado).toBe('ignorado');
      expect((await assinaturaDe(userId)).status).toBe('pendente');
    });

    it('assinatura cancelada pelo provedor marca cancelada', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);
      await enviarEvento(providerSubId, 'assinatura_cancelada');
      expect((await assinaturaDe(userId)).status).toBe('cancelada');
    });

    it('reembolso cancela e encerra o período agora', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);
      const antes = Date.now();
      await enviarEvento(providerSubId, 'reembolso');
      const linha = await assinaturaDe(userId);
      expect(linha.status).toBe('cancelada');
      expect(linha.periodoFim!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
      expect(linha.periodoFim!.getTime()).toBeLessThanOrEqual(Date.now());
      expect((await obter(userId)).json()).toMatchObject({ plano: 'gratis', status: 'cancelada' });
    });

    it('evento de assinatura desconhecida é aceito (200) e ignorado', async () => {
      const res = await enviarEvento('fake_sub_inexistente', 'pagamento_confirmado');
      expect(res.statusCode).toBe(200);
      expect(res.json().resultado).toBe('ignorado');
    });

    it('corpo corretamente assinado mas sem os campos do evento: 401', async () => {
      const incompleto = Buffer.from(JSON.stringify({ eventId: 'e' }));
      const assinatura = createHmac('sha256', t.app.get(ENV).SESSION_SECRET).update(incompleto).digest('hex');
      expect((await webhook(incompleto, { 'x-fake-assinatura': assinatura })).statusCode).toBe(401);
    });

    describe('renovação', () => {
      it('confirmação perto do fim do ciclo estende a partir do fim atual', async () => {
        const userId = await criarUsuario(t);
        const providerSubId = await ativar(userId);
        const fimAtual = new Date(Date.now() + 3 * DIA);
        await t.banco.db
          .update(subscriptions)
          .set({ periodoFim: fimAtual })
          .where(eq(subscriptions.userId, userId));

        await enviarEvento(providerSubId, 'pagamento_confirmado');
        const linha = await assinaturaDe(userId);
        expect(linha.periodoInicio).toEqual(fimAtual);
        expect(linha.periodoFim).toEqual(somarMeses(fimAtual, 1));
      });

      it('confirmação com o ciclo vencido começa um novo ciclo agora', async () => {
        const userId = await criarUsuario(t);
        const providerSubId = await ativar(userId);
        await t.banco.db
          .update(subscriptions)
          .set({ status: 'atrasada', periodoFim: new Date(Date.now() - 2 * DIA) })
          .where(eq(subscriptions.userId, userId));

        const antes = Date.now();
        await enviarEvento(providerSubId, 'pagamento_confirmado');
        const linha = await assinaturaDe(userId);
        expect(linha.status).toBe('ativa');
        expect(linha.periodoInicio!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
        expect(linha.periodoFim).toEqual(somarMeses(linha.periodoInicio!, 1));
      });

      it('outra confirmação no começo do ciclo (evento diferente, mesmo pagamento) não estende', async () => {
        const userId = await criarUsuario(t);
        const providerSubId = await ativar(userId);
        const antes = await assinaturaDe(userId);

        const res = await enviarEvento(providerSubId, 'pagamento_confirmado');
        expect(res.json().resultado).toBe('ignorado');
        expect(await assinaturaDe(userId)).toEqual(antes);
      });
    });
  });

  describe('cota no upgrade', () => {
    it('a cota passa de 30 para 1500 na hora, preservando confirmados e reservados', async () => {
      const userId = await criarUsuario(t);
      const gratis = await consultarCota(t.banco.db, userId);
      expect(gratis).toMatchObject({ plano: 'gratis', limite: 30 });
      await t.banco.db
        .update(quotaPeriods)
        .set({ cardsConfirmados: 22, cardsReservados: 6 })
        .where(eq(quotaPeriods.userId, userId));

      await ativar(userId);

      const cota = await consultarCota(t.banco.db, userId);
      expect(cota).toMatchObject({ plano: 'essencial', limite: 1500, confirmados: 22, reservados: 6, restante: 1472 });
      const assinatura = await assinaturaDe(userId);
      expect(cota.periodoFim).toEqual(assinatura.periodoFim);

      const res = await t.app.inject({ method: 'GET', url: '/v1/cota', headers: comoUsuario(userId) });
      expect(res.json()).toMatchObject({ limite: 1500, confirmados: 22, reservados: 6 });
    });

    it('o período grátis é encerrado agora e o consumo não é contado duas vezes', async () => {
      const userId = await criarUsuario(t);
      await consultarCota(t.banco.db, userId);
      await t.banco.db.update(quotaPeriods).set({ cardsConfirmados: 10 }).where(eq(quotaPeriods.userId, userId));
      const antes = Date.now();
      await ativar(userId);

      const periodos = await t.banco.db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, userId));
      expect(periodos).toHaveLength(2);
      const antigo = periodos.find((p) => p.limiteCards === 30)!;
      const novo = periodos.find((p) => p.limiteCards === 1500)!;
      expect(antigo.periodoFim.getTime()).toBeGreaterThanOrEqual(antes - 1000);
      expect(antigo.periodoFim.getTime()).toBeLessThanOrEqual(Date.now());
      expect(antigo).toMatchObject({ cardsConfirmados: 0, cardsReservados: 0 });
      expect(novo.cardsConfirmados).toBe(10);
    });

    it('job em andamento criado antes do upgrade libera a reserva no período novo', async () => {
      const userId = await criarUsuario(t);
      await consultarCota(t.banco.db, userId);
      const job = await inserirJobDireto(t, { userId }, { cardsReservados: 8 });
      await t.banco.db
        .update(quotaPeriods)
        .set({ cardsConfirmados: 5, cardsReservados: 8 })
        .where(eq(quotaPeriods.userId, userId));

      await ativar(userId);
      expect(await consultarCota(t.banco.db, userId)).toMatchObject({ confirmados: 5, reservados: 8 });

      await confirmarCota(t.banco.db, job.id, 6);
      expect(await consultarCota(t.banco.db, userId)).toMatchObject({
        limite: 1500,
        confirmados: 11,
        reservados: 0,
      });
    });

    it('sem período vigente, o próximo uso já nasce com a cota do plano', async () => {
      const userId = await criarUsuario(t);
      await ativar(userId);
      expect(await consultarCota(t.banco.db, userId)).toMatchObject({ plano: 'essencial', limite: 1500, confirmados: 0 });
    });

    it('plano ilimitado: 10.000 cards', async () => {
      const userId = await criarUsuario(t);
      await consultarCota(t.banco.db, userId);
      await ativar(userId, { plano: 'ilimitado', metodo: 'pix', cpfCnpj: CPF });
      expect(await consultarCota(t.banco.db, userId)).toMatchObject({ plano: 'ilimitado', limite: 10_000 });
    });

    it('renovação do mesmo plano não cria nem encerra períodos de cota', async () => {
      const userId = await criarUsuario(t);
      const providerSubId = await ativar(userId);
      await consultarCota(t.banco.db, userId);
      await t.banco.db
        .update(subscriptions)
        .set({ periodoFim: new Date(Date.now() + 2 * DIA) })
        .where(eq(subscriptions.userId, userId));
      const antes = await t.banco.db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, userId));

      await enviarEvento(providerSubId, 'pagamento_confirmado');

      const depois = await t.banco.db.select().from(quotaPeriods).where(eq(quotaPeriods.userId, userId));
      expect(depois).toEqual(antes);
    });
  });

  describe('POST /v1/webhooks/pagamento/simular', () => {
    it('gera o evento do fake e o processa como o webhook real', async () => {
      const userId = await criarUsuario(t);
      const { providerSubId } = (await assinar(userId)).json();
      const res = await t.app.inject({
        method: 'POST',
        url: '/v1/webhooks/pagamento/simular',
        payload: { providerSubId, tipo: 'pagamento_confirmado' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ recebido: true, resultado: 'processado' });
      expect((await assinaturaDe(userId)).status).toBe('ativa');
      expect((await obter(userId)).json().status).toBe('ativa');
    });

    it('valida o corpo', async () => {
      const res = await t.app.inject({
        method: 'POST',
        url: '/v1/webhooks/pagamento/simular',
        payload: { providerSubId: 'x', tipo: 'inventado' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});

describe('simular fora do provider fake', () => {
  it('responde 404 com PAGAMENTO_PROVIDER=asaas', async () => {
    const t = await criarAppTeste((b) =>
      b.overrideProvider(ENV).useValue(
        carregarEnv({
          NODE_ENV: 'test',
          PAGAMENTO_PROVIDER: 'asaas',
          ASAAS_API_KEY: 'chave',
          ASAAS_WEBHOOK_TOKEN: 'token-webhook',
        }),
      ),
    );
    try {
      const res = await t.app.inject({
        method: 'POST',
        url: '/v1/webhooks/pagamento/simular',
        payload: { providerSubId: 'sub_1', tipo: 'pagamento_confirmado' },
      });
      expect(res.statusCode).toBe(404);
      expect(t.app.get(PAGAMENTO_PROVIDER)).toBeInstanceOf(AsaasPagamentoProvider);
    } finally {
      await t.fechar();
    }
  });

  it('responde 404 em production, mesmo com o fake', async () => {
    const t = await criarAppTeste((b) =>
      b.overrideProvider(ENV).useValue(
        // O EnvSchema já recusa o fake em production; aqui se testa a segunda barreira, no controller.
        { ...carregarEnv({ NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40) }), NODE_ENV: 'production' },
      ),
    );
    try {
      const res = await t.app.inject({
        method: 'POST',
        url: '/v1/webhooks/pagamento/simular',
        payload: { providerSubId: 'sub_1', tipo: 'pagamento_confirmado' },
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await t.fechar();
    }
  });
});

describe('pagamento (provider Asaas, fetch falso)', () => {
  let t: AppTeste;
  let respostaAsaas: (url: string, init?: RequestInit) => Response;
  const chamadas: Array<{ url: string; method: string }> = [];

  const env = carregarEnv({
    NODE_ENV: 'test',
    PAGAMENTO_PROVIDER: 'asaas',
    ASAAS_API_KEY: 'chave-asaas',
    ASAAS_WEBHOOK_TOKEN: 'token-webhook',
  });

  beforeAll(async () => {
    const fetchFalso = (async (url: string | URL | Request, init?: RequestInit) => {
      chamadas.push({ url: String(url), method: init?.method ?? 'GET' });
      return respostaAsaas(String(url), init);
    }) as unknown as typeof fetch;
    t = await criarAppTeste((b) =>
      b
        .overrideProvider(ENV)
        .useValue(env)
        .overrideProvider(PAGAMENTO_PROVIDER)
        .useValue(
          new AsaasPagamentoProvider({
            baseUrl: env.ASAAS_BASE_URL,
            apiKey: 'chave-asaas',
            webhookToken: 'token-webhook',
            fetch: fetchFalso,
          }),
        ),
    );
  });
  afterAll(() => t.fechar());
  beforeEach(async () => {
    chamadas.length = 0;
    await t.banco.limpar();
  });

  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
  const webhook = (corpo: object, token: string | null = 'token-webhook') =>
    t.app.inject({
      method: 'POST',
      url: '/v1/webhooks/pagamento',
      headers: { 'content-type': 'application/json', ...(token ? { 'asaas-access-token': token } : {}) },
      payload: JSON.stringify(corpo),
    });

  it('assina com Pix pelo Asaas e depois ativa por webhook autenticado pelo token', async () => {
    respostaAsaas = (url, init) => {
      if (url.endsWith('/customers')) return json({ id: 'cus_1' });
      if (url.endsWith('/subscriptions')) return json({ id: 'sub_1' });
      if (url.endsWith('/subscriptions/sub_1/payments')) return json({ data: [{ id: 'pay_1', invoiceUrl: 'u' }] });
      if (url.endsWith('/payments/pay_1/pixQrCode')) return json({ encodedImage: 'QUJD', payload: '000201PIX' });
      throw new Error(`chamada inesperada ${init?.method} ${url}`);
    };
    const userId = await criarUsuario(t);

    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/assinaturas',
      headers: comoUsuario(userId),
      payload: { plano: 'essencial', metodo: 'pix', cpfCnpj: CPF },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      providerSubId: 'sub_1',
      providerCustomerId: 'cus_1',
      status: 'pendente',
      pixCopiaECola: '000201PIX',
      pixQrCodeBase64: 'QUJD',
    });

    expect((await webhook({ id: 'e1', event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub_1', value: 24.9, billingType: 'PIX' } }, 'errado')).statusCode).toBe(401);
    expect((await webhook({ id: 'e1', event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub_1' } }, null)).statusCode).toBe(401);
    const ok = await webhook({ id: 'e1', event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub_1', value: 24.9, billingType: 'PIX' } });
    expect(ok.statusCode).toBe(200);
    const [linha] = await t.banco.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    expect(linha.status).toBe('ativa');
    const [evento] = await t.banco.db.select().from(webhookEvents);
    expect(evento).toMatchObject({ eventId: 'e1', provider: 'asaas', tipo: 'pagamento_confirmado' });
    expect(evento.payload).toMatchObject({ event: 'PAYMENT_RECEIVED' });
  });

  it('eventos que o Cardify não usa respondem 200 sem efeito', async () => {
    const res = await webhook({ id: 'e2', event: 'PAYMENT_CREATED', payment: { subscription: 'sub_1' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ recebido: true, resultado: 'ignorado' });
    expect(await t.banco.db.select().from(webhookEvents)).toHaveLength(0);
  });

  it('erro do Asaas ao assinar vira 502 pagamento_falhou e não grava a assinatura', async () => {
    respostaAsaas = () => json({ errors: [{ description: 'CPF inválido' }] }, 400);
    const userId = await criarUsuario(t);

    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/assinaturas',
      headers: comoUsuario(userId),
      payload: { plano: 'essencial', metodo: 'pix', cpfCnpj: CPF },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ erro: 'pagamento_falhou', mensagem: 'Asaas respondeu 400: CPF inválido' });
    expect(await t.banco.db.select().from(subscriptions)).toHaveLength(0);
    const [usuario] = await t.banco.db.select().from(users);
    expect(usuario.providerCustomerId).toBeNull();
  });

  it('GET /assinatura pendente consulta a cobrança no Asaas; falha na consulta vira pagamentoPendente nulo', async () => {
    const userId = await criarUsuario(t);
    await t.banco.db.insert(subscriptions).values({ userId, plano: 'essencial', status: 'pendente', providerSubId: 'sub_9' });

    respostaAsaas = (url) =>
      url.endsWith('/subscriptions/sub_9/payments')
        ? json({ data: [{ id: 'pay_9', status: 'PENDING', billingType: 'BOLETO', invoiceUrl: 'https://asaas/i/9' }] })
        : json({}, 404);
    const res = await t.app.inject({ method: 'GET', url: '/v1/assinatura', headers: comoUsuario(userId) });
    expect(res.json().pagamentoPendente).toMatchObject({
      providerSubId: 'sub_9',
      status: 'pendente',
      urlPagamento: 'https://asaas/i/9',
    });

    respostaAsaas = () => json({}, 500);
    const falha = await t.app.inject({ method: 'GET', url: '/v1/assinatura', headers: comoUsuario(userId) });
    expect(falha.statusCode).toBe(200);
    expect(falha.json()).toMatchObject({ status: 'pendente', pagamentoPendente: null });
  });

  it('DELETE /assinatura chama DELETE /subscriptions/{id} no Asaas', async () => {
    respostaAsaas = () => json({ deleted: true });
    const userId = await criarUsuario(t);
    await t.banco.db.insert(subscriptions).values({
      userId,
      plano: 'essencial',
      status: 'ativa',
      providerSubId: 'sub_5',
      periodoInicio: new Date(),
      periodoFim: new Date(Date.now() + 10 * DIA),
    });
    const res = await t.app.inject({ method: 'DELETE', url: '/v1/assinatura', headers: comoUsuario(userId) });
    expect(res.statusCode).toBe(204);
    expect(chamadas).toEqual([{ url: `${env.ASAAS_BASE_URL}/subscriptions/sub_5`, method: 'DELETE' }]);
  });

  it('erro do Asaas ao cancelar vira 502 e a assinatura continua ativa', async () => {
    respostaAsaas = () => json({}, 500);
    const userId = await criarUsuario(t);
    await t.banco.db.insert(subscriptions).values({
      userId,
      plano: 'essencial',
      status: 'ativa',
      providerSubId: 'sub_5',
      periodoInicio: new Date(),
      periodoFim: new Date(Date.now() + 10 * DIA),
    });
    const res = await t.app.inject({ method: 'DELETE', url: '/v1/assinatura', headers: comoUsuario(userId) });
    expect(res.statusCode).toBe(502);
    const [linha] = await t.banco.db.select().from(subscriptions);
    expect(linha.status).toBe('ativa');
  });
});
