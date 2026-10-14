import { Inject, Injectable } from '@nestjs/common';
import {
  type Db,
  and,
  desc,
  eq,
  periodoAtual,
  quotaPeriods,
  sql,
  subscriptions,
  type SubscriptionRow,
  webhookEvents,
} from '@cardify/db';
import { type Env, type EventoPagamento, PLANOS, type Plano } from '@cardify/shared';
import { somarMeses } from './datas';
import { DB, ENV } from '../infra/tokens';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type ResultadoWebhook = 'processado' | 'duplicado' | 'ignorado';

const DIA_MS = 86_400_000;
/**
 * Confirmação com a assinatura ainda ativa só conta como renovação perto do fim do ciclo (a cobrança do
 * próximo ciclo pode ser paga alguns dias antes do vencimento); antes disso é reenvio e não estende nada.
 */
const JANELA_RENOVACAO_MS = { mensal: 15 * DIA_MS, anual: 45 * DIA_MS };

@Injectable()
export class WebhookService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Idempotente por `eventId`: o registro do evento e seus efeitos entram na mesma transação, então uma falha
   * desfaz os dois e o reenvio do provedor processa de novo.
   */
  async processar(evento: EventoPagamento, rawBody: Buffer, agora: Date = new Date()): Promise<ResultadoWebhook> {
    return this.db.transaction(async (tx) => {
      const [registrado] = await tx
        .insert(webhookEvents)
        .values({
          eventId: evento.eventId,
          provider: this.env.PAGAMENTO_PROVIDER,
          tipo: evento.tipo,
          payload: this.payload(evento, rawBody),
        })
        .onConflictDoNothing()
        .returning({ eventId: webhookEvents.eventId });
      if (!registrado) return 'duplicado';

      const [assinatura] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.providerSubId, evento.providerSubId))
        .for('update');
      if (!assinatura) return 'ignorado';

      switch (evento.tipo) {
        case 'pagamento_confirmado':
          return this.confirmar(tx, assinatura, agora);
        case 'pagamento_atrasado':
          // Cobrança inicial vencida não é inadimplência: a assinatura segue pendente (sem acesso).
          if (assinatura.status !== 'ativa' && assinatura.status !== 'atrasada') return 'ignorado';
          await this.atualizar(tx, assinatura, { status: 'atrasada' });
          return 'processado';
        case 'assinatura_cancelada':
          await this.atualizar(tx, assinatura, { status: 'cancelada' });
          return 'processado';
        case 'reembolso':
          await this.atualizar(tx, assinatura, { status: 'cancelada', periodoFim: agora });
          return 'processado';
      }
    });
  }

  private async confirmar(tx: Tx, assinatura: SubscriptionRow, agora: Date): Promise<ResultadoWebhook> {
    const anual = assinatura.plano === 'anual';
    const fimAtual = assinatura.periodoFim && assinatura.periodoFim > agora ? assinatura.periodoFim : null;

    let inicio = agora;
    if (assinatura.status === 'ativa' && fimAtual) {
      const janela = anual ? JANELA_RENOVACAO_MS.anual : JANELA_RENOVACAO_MS.mensal;
      if (agora.getTime() < fimAtual.getTime() - janela) return 'ignorado';
      inicio = fimAtual;
    } else if (assinatura.status === 'atrasada' && fimAtual) {
      inicio = fimAtual;
    }

    await this.atualizar(tx, assinatura, {
      status: 'ativa',
      periodoInicio: inicio,
      periodoFim: somarMeses(inicio, anual ? 12 : 1),
    });
    if (inicio <= agora) await this.aplicarCotaDoPlano(tx, assinatura.userId, assinatura.plano, agora);
    return 'processado';
  }

  /**
   * Upgrade imediato: o período de cota vigente nasceu sob outro plano (grátis), então é encerrado agora e o
   * consumo passa para um período do plano novo.
   *
   * O novo período herda `periodoInicio` do antigo (+1 ms): `encerrarReserva` (cota.ts) localiza o período de um
   * job por `job.createdAt`, e jobs em andamento foram criados dentro da janela do período antigo. Com o
   * início retroativo eles resolvem para o período novo, onde a reserva transferida é liberada.
   */
  private async aplicarCotaDoPlano(tx: Tx, userId: string, plano: Plano, agora: Date): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'cota:' + userId}, 0))`);
    const [vigente] = await tx
      .select()
      .from(quotaPeriods)
      .where(
        and(
          eq(quotaPeriods.userId, userId),
          sql`${quotaPeriods.periodoInicio} <= ${agora}`,
          sql`${quotaPeriods.periodoFim} > ${agora}`,
        ),
      )
      .orderBy(desc(quotaPeriods.periodoInicio))
      .limit(1)
      .for('update');
    if (!vigente || vigente.limiteCards === PLANOS[plano].cotaCardsMes) return;

    await tx
      .update(quotaPeriods)
      .set({ periodoFim: agora, cardsConfirmados: 0, cardsReservados: 0 })
      .where(eq(quotaPeriods.id, vigente.id));
    const novo = await periodoAtual(tx, userId, agora);
    await tx
      .update(quotaPeriods)
      .set({
        periodoInicio: new Date(Math.min(vigente.periodoInicio.getTime() + 1, agora.getTime())),
        cardsConfirmados: vigente.cardsConfirmados,
        cardsReservados: vigente.cardsReservados,
      })
      .where(eq(quotaPeriods.id, novo.id));
  }

  private async atualizar(tx: Tx, assinatura: SubscriptionRow, mudancas: Partial<SubscriptionRow>): Promise<void> {
    await tx
      .update(subscriptions)
      .set({ ...mudancas, updatedAt: new Date() })
      .where(eq(subscriptions.id, assinatura.id));
  }

  private payload(evento: EventoPagamento, rawBody: Buffer): unknown {
    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      return evento;
    }
  }
}
