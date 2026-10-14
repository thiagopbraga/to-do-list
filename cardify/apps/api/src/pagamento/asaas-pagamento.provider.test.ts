import { timingSafeEqual } from 'node:crypto';
import { CardifyError, WebhookInvalidoError } from '@cardify/shared';
import { AsaasPagamentoProvider } from './asaas-pagamento.provider';
import { PagamentoFalhouError } from './provider';

vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:crypto')>();
  return { ...original, timingSafeEqual: vi.fn(original.timingSafeEqual) };
});

interface Chamada {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Resposta = { status?: number; corpo?: unknown; texto?: string };

function fetchFalso(respostas: Resposta[]) {
  const chamadas: Chamada[] = [];
  const fila = [...respostas];
  const falso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const r = fila.shift() ?? { status: 500, texto: 'sem resposta programada' };
    return new Response(r.texto ?? JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200 });
  });
  return { chamadas, fetch: falso as unknown as typeof fetch };
}

const TOKEN = 'token-do-webhook';
// 02:00 UTC de 14/10 ainda é dia 13 em São Paulo.
const AGORA = new Date('2026-10-14T02:00:00Z');

function criar(respostas: Resposta[] = []) {
  const { chamadas, fetch } = fetchFalso(respostas);
  const provider = new AsaasPagamentoProvider({
    baseUrl: 'https://api-sandbox.asaas.com/v3/',
    apiKey: 'chave-asaas',
    webhookToken: TOKEN,
    fetch,
    agora: () => AGORA,
  });
  return { provider, chamadas };
}

const CLIENTE = { userId: 'u-1', email: 'ana@exemplo.com', nome: 'Ana', cpfCnpj: '52998224725' };

describe('AsaasPagamentoProvider.criarAssinatura', () => {
  it('Pix: cria cliente, assinatura, lê a primeira cobrança e o QR Code', async () => {
    const { provider, chamadas } = criar([
      { corpo: { id: 'cus_1' } },
      { corpo: { id: 'sub_1' } },
      { corpo: { data: [{ id: 'pay_1', invoiceUrl: 'https://asaas/i/1' }] } },
      { corpo: { encodedImage: 'QUJD', payload: '000201PIX' } },
    ]);

    const resultado = await provider.criarAssinatura(CLIENTE, 'essencial', 'pix');

    expect(resultado).toEqual({
      providerSubId: 'sub_1',
      providerCustomerId: 'cus_1',
      status: 'pendente',
      pixCopiaECola: '000201PIX',
      pixQrCodeBase64: 'QUJD',
    });
    expect(chamadas.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST https://api-sandbox.asaas.com/v3/customers',
      'POST https://api-sandbox.asaas.com/v3/subscriptions',
      'GET https://api-sandbox.asaas.com/v3/subscriptions/sub_1/payments',
      'GET https://api-sandbox.asaas.com/v3/payments/pay_1/pixQrCode',
    ]);
    expect(chamadas[0].body).toEqual({
      name: 'Ana',
      email: 'ana@exemplo.com',
      cpfCnpj: '52998224725',
      externalReference: 'u-1',
    });
    expect(chamadas[1].body).toEqual({
      customer: 'cus_1',
      billingType: 'PIX',
      value: 24.9,
      nextDueDate: '2026-10-13',
      cycle: 'MONTHLY',
      description: 'Cardify Essencial',
      externalReference: 'u-1',
    });
  });

  it('envia access_token e User-Agent em toda chamada, e Content-Type só quando há corpo', async () => {
    const { provider, chamadas } = criar([
      { corpo: { id: 'cus_1' } },
      { corpo: { id: 'sub_1' } },
      { corpo: { data: [{ id: 'pay_1', invoiceUrl: 'https://asaas/i/1' }] } },
    ]);
    await provider.criarAssinatura(CLIENTE, 'essencial', 'boleto');

    for (const chamada of chamadas) {
      expect(chamada.headers).toMatchObject({ access_token: 'chave-asaas', 'User-Agent': 'cardify' });
    }
    expect(chamadas[0].headers['Content-Type']).toBe('application/json');
    expect(chamadas[2].headers['Content-Type']).toBeUndefined();
  });

  it('cartão e boleto devolvem a invoiceUrl e não consultam o QR Code', async () => {
    for (const [metodo, billingType] of [
      ['cartao', 'CREDIT_CARD'],
      ['boleto', 'BOLETO'],
    ] as const) {
      const { provider, chamadas } = criar([
        { corpo: { id: 'sub_2' } },
        { corpo: { data: [{ id: 'pay_2', invoiceUrl: 'https://asaas/i/2' }] } },
      ]);
      const resultado = await provider.criarAssinatura(
        { ...CLIENTE, providerCustomerId: 'cus_existente' },
        'ilimitado',
        metodo,
      );

      expect(resultado).toEqual({
        providerSubId: 'sub_2',
        providerCustomerId: 'cus_existente',
        status: 'pendente',
        urlPagamento: 'https://asaas/i/2',
      });
      expect(chamadas).toHaveLength(2);
      expect(chamadas[0].body).toMatchObject({ customer: 'cus_existente', billingType, value: 44.9 });
    }
  });

  it('reaproveita o cliente existente sem chamar POST /customers', async () => {
    const { provider, chamadas } = criar([{ corpo: { id: 'sub_1' } }, { corpo: { data: [{ id: 'p', invoiceUrl: 'u' }] } }]);
    await provider.criarAssinatura({ ...CLIENTE, providerCustomerId: 'cus_9' }, 'essencial', 'cartao');
    expect(chamadas.some((c) => c.url.endsWith('/customers'))).toBe(false);
  });

  it('plano anual: cycle YEARLY e valor 249', async () => {
    const { provider, chamadas } = criar([{ corpo: { id: 'sub_1' } }, { corpo: { data: [{ id: 'p', invoiceUrl: 'u' }] } }]);
    await provider.criarAssinatura({ ...CLIENTE, providerCustomerId: 'cus_9' }, 'anual', 'cartao');
    expect(chamadas[0].body).toMatchObject({ cycle: 'YEARLY', value: 249, description: 'Cardify Anual' });
  });

  it('usa o e-mail como nome quando o usuário não tem nome', async () => {
    const { provider, chamadas } = criar([
      { corpo: { id: 'cus_1' } },
      { corpo: { id: 'sub_1' } },
      { corpo: { data: [{ id: 'p', invoiceUrl: 'u' }] } },
    ]);
    await provider.criarAssinatura({ ...CLIENTE, nome: undefined }, 'essencial', 'boleto');
    expect(chamadas[0].body).toMatchObject({ name: 'ana@exemplo.com' });
  });

  it('exige CPF/CNPJ para criar o cliente', async () => {
    const { provider, chamadas } = criar();
    await expect(provider.criarAssinatura({ ...CLIENTE, cpfCnpj: undefined }, 'essencial', 'pix')).rejects.toMatchObject({
      codigo: 'cpf_cnpj_obrigatorio',
    });
    expect(chamadas).toHaveLength(0);
  });

  it('erro HTTP vira pagamento_falhou com a descrição do Asaas', async () => {
    const { provider } = criar([{ status: 400, corpo: { errors: [{ code: 'invalid_cpfCnpj', description: 'CPF inválido' }] } }]);
    const erro = await provider.criarAssinatura(CLIENTE, 'essencial', 'pix').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(PagamentoFalhouError);
    expect(erro).toBeInstanceOf(CardifyError);
    expect(erro).toMatchObject({ codigo: 'pagamento_falhou', message: 'Asaas respondeu 400: CPF inválido' });
  });

  it('falha de rede e corpo não-JSON também viram pagamento_falhou', async () => {
    const rede = new AsaasPagamentoProvider({
      baseUrl: 'https://x/v3',
      apiKey: 'k',
      webhookToken: TOKEN,
      fetch: (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch,
    });
    await expect(rede.criarAssinatura(CLIENTE, 'essencial', 'pix')).rejects.toMatchObject({ codigo: 'pagamento_falhou' });

    const { provider } = criar([{ status: 502, texto: '<html>bad gateway</html>' }]);
    await expect(provider.criarAssinatura(CLIENTE, 'essencial', 'pix')).rejects.toMatchObject({
      codigo: 'pagamento_falhou',
      message: expect.stringContaining('502'),
    });
  });

  it('falha quando o Asaas não gera a primeira cobrança', async () => {
    const { provider } = criar([{ corpo: { id: 'sub_1' } }, { corpo: { data: [] } }]);
    await expect(
      provider.criarAssinatura({ ...CLIENTE, providerCustomerId: 'cus_1' }, 'essencial', 'pix'),
    ).rejects.toMatchObject({ codigo: 'pagamento_falhou' });
  });
});

describe('AsaasPagamentoProvider.cancelarAssinatura', () => {
  it('chama DELETE /subscriptions/{id}', async () => {
    const { provider, chamadas } = criar([{ corpo: { deleted: true, id: 'sub_1' } }]);
    await provider.cancelarAssinatura('sub_1');
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatchObject({
      method: 'DELETE',
      url: 'https://api-sandbox.asaas.com/v3/subscriptions/sub_1',
      body: undefined,
    });
  });

  it('assinatura já removida (404) é sucesso; outros erros propagam', async () => {
    await expect(criar([{ status: 404, corpo: {} }]).provider.cancelarAssinatura('sub_1')).resolves.toBeUndefined();
    await expect(criar([{ status: 500, corpo: {} }]).provider.cancelarAssinatura('sub_1')).rejects.toMatchObject({
      codigo: 'pagamento_falhou',
    });
  });
});

describe('AsaasPagamentoProvider.consultarPagamentoPendente', () => {
  it('Pix pendente devolve o QR Code; sem cobrança pendente devolve null', async () => {
    const { provider, chamadas } = criar([
      {
        corpo: {
          data: [
            { id: 'pay_2', status: 'PENDING', billingType: 'PIX', invoiceUrl: 'u2' },
            { id: 'pay_1', status: 'RECEIVED', billingType: 'PIX', invoiceUrl: 'u1' },
          ],
        },
      },
      { corpo: { encodedImage: 'QUJD', payload: 'PIX' } },
    ]);
    await expect(provider.consultarPagamentoPendente('sub_1')).resolves.toEqual({
      pixCopiaECola: 'PIX',
      pixQrCodeBase64: 'QUJD',
    });
    expect(chamadas[1].url).toMatch(/\/payments\/pay_2\/pixQrCode$/);

    const vazio = criar([{ corpo: { data: [{ id: 'pay_1', status: 'RECEIVED' }] } }]);
    await expect(vazio.provider.consultarPagamentoPendente('sub_1')).resolves.toBeNull();
  });

  it('cartão pendente devolve a invoiceUrl', async () => {
    const { provider } = criar([
      { corpo: { data: [{ id: 'pay_1', status: 'PENDING', billingType: 'CREDIT_CARD', invoiceUrl: 'https://asaas/i/1' }] } },
    ]);
    await expect(provider.consultarPagamentoPendente('sub_1')).resolves.toEqual({ urlPagamento: 'https://asaas/i/1' });
  });
});

describe('AsaasPagamentoProvider.interpretarWebhook', () => {
  const { provider } = criar();
  const headers = { 'asaas-access-token': TOKEN };
  const corpo = (objeto: unknown) => Buffer.from(JSON.stringify(objeto));

  it.each([
    ['PAYMENT_CONFIRMED', 'pagamento_confirmado'],
    ['PAYMENT_RECEIVED', 'pagamento_confirmado'],
    ['PAYMENT_OVERDUE', 'pagamento_atrasado'],
    ['PAYMENT_REFUNDED', 'reembolso'],
  ])('%s vira %s', (event, tipo) => {
    const evento = provider.interpretarWebhook(
      corpo({
        id: 'evt_1',
        event,
        dateCreated: '2026-10-14 10:30:00',
        payment: { id: 'pay_1', subscription: 'sub_1', value: 24.9, billingType: 'PIX' },
      }),
      headers,
    );
    expect(evento).toEqual({
      eventId: 'evt_1',
      tipo,
      providerSubId: 'sub_1',
      valorCentavos: 2490,
      ocorridoEm: '2026-10-14T13:30:00.000Z',
    });
  });

  it('SUBSCRIPTION_DELETED usa subscription.id', () => {
    const evento = provider.interpretarWebhook(
      corpo({ id: 'evt_2', event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_7' } }),
      headers,
    );
    expect(evento).toMatchObject({ eventId: 'evt_2', tipo: 'assinatura_cancelada', providerSubId: 'sub_7' });
    expect(evento?.valorCentavos).toBeUndefined();
    expect(evento?.ocorridoEm).toBe(AGORA.toISOString());
  });

  it('eventos desconhecidos e cobranças avulsas (sem subscription) são ignorados', () => {
    expect(
      provider.interpretarWebhook(corpo({ id: 'e', event: 'PAYMENT_CREATED', payment: { subscription: 'sub_1' } }), headers),
    ).toBeNull();
    expect(provider.interpretarWebhook(corpo({ id: 'e', event: 'PAYMENT_CONFIRMED', payment: { value: 10 } }), headers)).toBeNull();
    expect(provider.interpretarWebhook(corpo({ id: 'e', event: 'SUBSCRIPTION_DELETED' }), headers)).toBeNull();
  });

  it('PAYMENT_RECEIVED de cartão é a liquidação do que PAYMENT_CONFIRMED já ativou: ignorado', () => {
    const payment = { subscription: 'sub_1', value: 24.9, billingType: 'CREDIT_CARD' };
    expect(provider.interpretarWebhook(corpo({ id: 'e', event: 'PAYMENT_RECEIVED', payment }), headers)).toBeNull();
    expect(provider.interpretarWebhook(corpo({ id: 'e', event: 'PAYMENT_CONFIRMED', payment }), headers)).not.toBeNull();
  });

  it('token ausente, errado ou de outro tamanho lança WebhookInvalidoError', () => {
    const bruto = corpo({ id: 'e', event: 'PAYMENT_CONFIRMED', payment: { subscription: 's' } });
    for (const h of [{}, { 'asaas-access-token': 'errado' }, { 'asaas-access-token': TOKEN + 'x' }, { 'asaas-access-token': '' }]) {
      expect(() => provider.interpretarWebhook(bruto, h)).toThrow(WebhookInvalidoError);
    }
  });

  it('compara o token em tempo constante (timingSafeEqual)', () => {
    vi.mocked(timingSafeEqual).mockClear();
    provider.interpretarWebhook(corpo({ id: 'e', event: 'PAYMENT_CREATED' }), headers);
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);

    expect(() => provider.interpretarWebhook(corpo({ id: 'e', event: 'PAYMENT_CREATED' }), { 'asaas-access-token': 'curto' })).toThrow(
      WebhookInvalidoError,
    );
    expect(timingSafeEqual).toHaveBeenCalledTimes(2);
  });

  it('o nome do header não diferencia maiúsculas', () => {
    expect(
      provider.interpretarWebhook(corpo({ id: 'e', event: 'PAYMENT_CREATED' }), { 'Asaas-Access-Token': TOKEN }),
    ).toBeNull();
  });

  it('corpo com token válido mas malformado é erro 400, não 401', () => {
    expect(() => provider.interpretarWebhook(Buffer.from('não é json'), headers)).toThrow(
      expect.objectContaining({ codigo: 'webhook_corpo_invalido' }),
    );
    expect(() => provider.interpretarWebhook(corpo({ event: 'PAYMENT_CONFIRMED' }), headers)).toThrow(
      expect.objectContaining({ codigo: 'webhook_corpo_invalido' }),
    );
  });
});
