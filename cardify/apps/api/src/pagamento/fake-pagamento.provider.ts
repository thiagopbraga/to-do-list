import { createHmac, randomUUID } from 'node:crypto';
import {
  type ClientePagamento,
  type EventoPagamento,
  type MetodoPagamento,
  type PlanoPago,
  type ResultadoAssinatura,
  type TipoEventoPagamento,
  WebhookInvalidoError,
} from '@cardify/shared';
import type { DadosPagamentoPendente, PagamentoProviderConsultavel } from './provider';
import { cabecalho, segredosIguais } from './seguranca';

export const HEADER_ASSINATURA_FAKE = 'x-fake-assinatura';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const TIPOS: readonly TipoEventoPagamento[] = [
  'pagamento_confirmado',
  'pagamento_atrasado',
  'assinatura_cancelada',
  'reembolso',
];

/** Provedor para dev e testes: nada sai da máquina e o webhook é assinado com HMAC-SHA256 do corpo. */
export class FakePagamentoProvider implements PagamentoProviderConsultavel {
  private readonly metodos = new Map<string, MetodoPagamento>();
  readonly canceladas: string[] = [];

  constructor(private readonly segredo: string) {}

  async criarAssinatura(
    cliente: ClientePagamento,
    _plano: PlanoPago,
    metodo: MetodoPagamento,
  ): Promise<ResultadoAssinatura> {
    const providerSubId = `fake_sub_${randomUUID()}`;
    this.metodos.set(providerSubId, metodo);
    return {
      providerSubId,
      providerCustomerId: cliente.providerCustomerId ?? `fake_cus_${randomUUID()}`,
      status: 'pendente',
      ...this.dadosDePagamento(providerSubId, metodo),
    };
  }

  async consultarPagamentoPendente(providerSubId: string): Promise<DadosPagamentoPendente | null> {
    return this.dadosDePagamento(providerSubId, this.metodos.get(providerSubId) ?? 'pix');
  }

  async cancelarAssinatura(providerSubId: string): Promise<void> {
    this.canceladas.push(providerSubId);
  }

  interpretarWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): EventoPagamento | null {
    const assinatura = cabecalho(headers, HEADER_ASSINATURA_FAKE);
    if (!assinatura || !segredosIguais(assinatura, this.assinar(rawBody))) throw new WebhookInvalidoError();

    let corpo: Partial<EventoPagamento>;
    try {
      corpo = JSON.parse(rawBody.toString('utf8')) as Partial<EventoPagamento>;
    } catch {
      throw new WebhookInvalidoError('corpo do webhook não é JSON');
    }
    const { eventId, tipo, providerSubId, ocorridoEm, valorCentavos } = corpo;
    if (!eventId || !providerSubId || !tipo || !TIPOS.includes(tipo) || !ocorridoEm) {
      throw new WebhookInvalidoError('corpo do webhook incompleto');
    }
    return { eventId, tipo, providerSubId, ocorridoEm, ...(valorCentavos === undefined ? {} : { valorCentavos }) };
  }

  gerarEvento(
    providerSubId: string,
    tipo: TipoEventoPagamento,
    eventId: string = `fake_evt_${randomUUID()}`,
  ): { rawBody: Buffer; headers: Record<string, string> } {
    const evento: EventoPagamento = { eventId, tipo, providerSubId, ocorridoEm: new Date().toISOString() };
    const rawBody = Buffer.from(JSON.stringify(evento), 'utf8');
    return { rawBody, headers: { [HEADER_ASSINATURA_FAKE]: this.assinar(rawBody) } };
  }

  private assinar(rawBody: Buffer): string {
    return createHmac('sha256', this.segredo).update(rawBody).digest('hex');
  }

  private dadosDePagamento(providerSubId: string, metodo: MetodoPagamento): DadosPagamentoPendente {
    if (metodo === 'pix') {
      return {
        pixCopiaECola: `00020126FAKE5204000053039865802BR${providerSubId}`,
        pixQrCodeBase64: PNG_1X1_BASE64,
      };
    }
    return { urlPagamento: `https://pagamento.fake.cardify.local/pagar/${providerSubId}` };
  }
}
