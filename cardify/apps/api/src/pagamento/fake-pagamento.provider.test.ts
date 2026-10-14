import { WebhookInvalidoError } from '@cardify/shared';
import { FakePagamentoProvider } from './fake-pagamento.provider';

describe('FakePagamentoProvider', () => {
  const provider = new FakePagamentoProvider('segredo');
  const cliente = { userId: 'u', email: 'a@b.c' };

  it('gera ids fake_cus_*/fake_sub_* e reaproveita o cliente existente', async () => {
    const nova = await provider.criarAssinatura(cliente, 'essencial', 'pix');
    expect(nova.providerSubId).toMatch(/^fake_sub_/);
    expect(nova.providerCustomerId).toMatch(/^fake_cus_/);
    const outra = await provider.criarAssinatura({ ...cliente, providerCustomerId: 'fake_cus_x' }, 'anual', 'cartao');
    expect(outra.providerCustomerId).toBe('fake_cus_x');
    expect(outra.pixCopiaECola).toBeUndefined();
    expect(outra.urlPagamento).toBeDefined();
  });

  it('o evento gerado round-trip pelo interpretarWebhook', () => {
    const { rawBody, headers } = provider.gerarEvento('fake_sub_1', 'reembolso', 'evt_1');
    expect(provider.interpretarWebhook(rawBody, headers)).toMatchObject({
      eventId: 'evt_1',
      tipo: 'reembolso',
      providerSubId: 'fake_sub_1',
    });
  });

  it('rejeita corpo adulterado, segredo diferente e JSON inválido', () => {
    const { rawBody, headers } = provider.gerarEvento('fake_sub_1', 'reembolso');
    expect(() => provider.interpretarWebhook(Buffer.concat([rawBody, Buffer.from(' ')]), headers)).toThrow(WebhookInvalidoError);
    const estranho = new FakePagamentoProvider('outro').gerarEvento('fake_sub_1', 'reembolso');
    expect(() => provider.interpretarWebhook(estranho.rawBody, estranho.headers)).toThrow(WebhookInvalidoError);
    expect(() => provider.interpretarWebhook(rawBody, {})).toThrow(WebhookInvalidoError);
  });
});
