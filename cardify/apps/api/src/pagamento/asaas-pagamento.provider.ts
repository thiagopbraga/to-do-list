import {
  CardifyError,
  type ClientePagamento,
  type EventoPagamento,
  type MetodoPagamento,
  PLANOS,
  type PlanoPago,
  type ResultadoAssinatura,
  type TipoEventoPagamento,
  WebhookInvalidoError,
} from '@cardify/shared';
import { dataSaoPaulo } from './datas';
import { type DadosPagamentoPendente, PagamentoFalhouError, type PagamentoProviderConsultavel } from './provider';
import { cabecalho, segredosIguais } from './seguranca';

export interface AsaasConfig {
  baseUrl: string;
  apiKey: string;
  webhookToken: string;
  fetch?: typeof fetch;
  agora?: () => Date;
}

const BILLING_TYPE: Record<MetodoPagamento, string> = { pix: 'PIX', cartao: 'CREDIT_CARD', boleto: 'BOLETO' };

const EVENTOS: Record<string, TipoEventoPagamento> = {
  PAYMENT_CONFIRMED: 'pagamento_confirmado',
  PAYMENT_RECEIVED: 'pagamento_confirmado',
  PAYMENT_OVERDUE: 'pagamento_atrasado',
  PAYMENT_REFUNDED: 'reembolso',
  SUBSCRIPTION_DELETED: 'assinatura_cancelada',
};

interface AsaasCobranca {
  id: string;
  status?: string;
  billingType?: string;
  invoiceUrl?: string;
}

interface CorpoWebhookAsaas {
  id?: unknown;
  event?: unknown;
  dateCreated?: unknown;
  payment?: { subscription?: unknown; value?: unknown; billingType?: unknown } | null;
  subscription?: { id?: unknown } | null;
}

export class AsaasPagamentoProvider implements PagamentoProviderConsultavel {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly agora: () => Date;

  constructor(private readonly config: AsaasConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fetch = config.fetch ?? fetch;
    this.agora = config.agora ?? (() => new Date());
  }

  async criarAssinatura(
    cliente: ClientePagamento,
    plano: PlanoPago,
    metodo: MetodoPagamento,
  ): Promise<ResultadoAssinatura> {
    const providerCustomerId = cliente.providerCustomerId ?? (await this.criarCliente(cliente));
    const definicao = PLANOS[plano];
    const assinatura = await this.chamar<{ id: string }>('POST', '/subscriptions', {
      customer: providerCustomerId,
      billingType: BILLING_TYPE[metodo],
      value: definicao.precoCentavos / 100,
      nextDueDate: dataSaoPaulo(this.agora()),
      cycle: definicao.periodicidade === 'anual' ? 'YEARLY' : 'MONTHLY',
      description: `Cardify ${definicao.nome}`,
      externalReference: cliente.userId,
    });

    const { data } = await this.chamar<{ data: AsaasCobranca[] }>('GET', `/subscriptions/${assinatura.id}/payments`);
    const cobranca = data?.[0];
    if (!cobranca) throw new PagamentoFalhouError('Asaas não gerou a primeira cobrança da assinatura');

    return {
      providerSubId: assinatura.id,
      providerCustomerId,
      status: 'pendente',
      ...(await this.dadosDaCobranca(cobranca, metodo === 'pix')),
    };
  }

  async consultarPagamentoPendente(providerSubId: string): Promise<DadosPagamentoPendente | null> {
    const { data } = await this.chamar<{ data: AsaasCobranca[] }>('GET', `/subscriptions/${providerSubId}/payments`);
    const cobranca = data?.find((c) => c.status === 'PENDING' || c.status === 'OVERDUE');
    if (!cobranca) return null;
    return this.dadosDaCobranca(cobranca, cobranca.billingType === 'PIX');
  }

  async cancelarAssinatura(providerSubId: string): Promise<void> {
    await this.chamar('DELETE', `/subscriptions/${providerSubId}`, undefined, { toleraNaoEncontrado: true });
  }

  interpretarWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): EventoPagamento | null {
    const token = cabecalho(headers, 'asaas-access-token');
    if (!token || !segredosIguais(token, this.config.webhookToken)) throw new WebhookInvalidoError();

    let corpo: CorpoWebhookAsaas;
    try {
      corpo = JSON.parse(rawBody.toString('utf8')) as CorpoWebhookAsaas;
    } catch {
      throw new CardifyError('webhook_corpo_invalido', 'corpo do webhook não é JSON');
    }
    if (typeof corpo?.id !== 'string' || typeof corpo.event !== 'string') {
      throw new CardifyError('webhook_corpo_invalido', 'webhook sem id ou event');
    }

    const tipo = EVENTOS[corpo.event];
    if (!tipo) return null;
    // Cartão gera PAYMENT_CONFIRMED na aprovação e PAYMENT_RECEIVED ~32 dias depois, na liquidação: só o primeiro vale.
    if (corpo.event === 'PAYMENT_RECEIVED' && corpo.payment?.billingType === 'CREDIT_CARD') return null;

    const providerSubId = corpo.event === 'SUBSCRIPTION_DELETED' ? corpo.subscription?.id : corpo.payment?.subscription;
    if (typeof providerSubId !== 'string' || !providerSubId) return null;

    const valor = corpo.payment?.value;
    return {
      eventId: corpo.id,
      tipo,
      providerSubId,
      ...(typeof valor === 'number' ? { valorCentavos: Math.round(valor * 100) } : {}),
      ocorridoEm: this.instante(corpo.dateCreated),
    };
  }

  private async criarCliente(cliente: ClientePagamento): Promise<string> {
    if (!cliente.cpfCnpj) throw new CardifyError('cpf_cnpj_obrigatorio', 'CPF ou CNPJ é obrigatório para assinar');
    const { id } = await this.chamar<{ id: string }>('POST', '/customers', {
      name: cliente.nome ?? cliente.email,
      email: cliente.email,
      cpfCnpj: cliente.cpfCnpj,
      externalReference: cliente.userId,
    });
    return id;
  }

  private async dadosDaCobranca(cobranca: AsaasCobranca, pix: boolean): Promise<DadosPagamentoPendente> {
    if (!pix) return { urlPagamento: cobranca.invoiceUrl };
    const qr = await this.chamar<{ encodedImage: string; payload: string }>('GET', `/payments/${cobranca.id}/pixQrCode`);
    return { pixCopiaECola: qr.payload, pixQrCodeBase64: qr.encodedImage };
  }

  private instante(dateCreated: unknown): string {
    // O Asaas manda "YYYY-MM-DD HH:mm:ss" em horário de Brasília (UTC-3, sem horário de verão).
    if (typeof dateCreated === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateCreated)) {
      const data = new Date(`${dateCreated.replace(' ', 'T')}-03:00`);
      if (!Number.isNaN(data.getTime())) return data.toISOString();
    }
    return this.agora().toISOString();
  }

  private async chamar<T>(
    metodo: 'GET' | 'POST' | 'DELETE',
    caminho: string,
    corpo?: unknown,
    opcoes: { toleraNaoEncontrado?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      access_token: this.config.apiKey,
      'User-Agent': 'cardify',
      Accept: 'application/json',
    };
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';

    let resposta: Response;
    try {
      resposta = await this.fetch(`${this.baseUrl}${caminho}`, {
        method: metodo,
        headers,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch (erro) {
      throw new PagamentoFalhouError(`Asaas inacessível: ${erro instanceof Error ? erro.message : String(erro)}`);
    }

    if (!resposta.ok) {
      if (opcoes.toleraNaoEncontrado && resposta.status === 404) return undefined as T;
      throw new PagamentoFalhouError(await this.descreverErro(resposta));
    }
    try {
      return (await resposta.json()) as T;
    } catch {
      throw new PagamentoFalhouError('Asaas devolveu uma resposta que não é JSON');
    }
  }

  private async descreverErro(resposta: Response): Promise<string> {
    const texto = await resposta.text().catch(() => '');
    let detalhe = texto.slice(0, 200);
    try {
      const erros = (JSON.parse(texto) as { errors?: Array<{ description?: string }> }).errors;
      const descricoes = erros?.map((e) => e.description).filter(Boolean);
      if (descricoes?.length) detalhe = descricoes.join('; ');
    } catch {
      // corpo não era JSON: fica o texto cru
    }
    return `Asaas respondeu ${resposta.status}${detalhe ? `: ${detalhe}` : ''}`;
  }
}
