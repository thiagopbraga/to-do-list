import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type Db, and, desc, eq, inArray, sql, subscriptions, type SubscriptionRow, users } from '@cardify/db';
import type { Plano, ResultadoAssinatura } from '@cardify/shared';
import { DB } from '../infra/tokens';
import { PAGAMENTO_PROVIDER } from './tokens';
import type { PagamentoProviderConsultavel } from './provider';
import type { AssinarComCpf } from './schemas';

export type StatusAssinatura = 'ativa' | 'pendente' | 'atrasada' | 'cancelada';

export interface AssinaturaResumo {
  plano: Plano;
  status: StatusAssinatura | null;
  periodoFim: string | null;
  pagamentoPendente: ResultadoAssinatura | null;
}

const PRIORIDADE: Record<StatusAssinatura, number> = { ativa: 0, atrasada: 1, pendente: 2, cancelada: 3 };

@Injectable()
export class AssinaturaService {
  private readonly log = new Logger(AssinaturaService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(PAGAMENTO_PROVIDER) private readonly provider: PagamentoProviderConsultavel,
  ) {}

  async obter(userId: string, agora: Date = new Date()): Promise<AssinaturaResumo> {
    const linhas = await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    const atual = [...linhas].sort(
      (a, b) =>
        PRIORIDADE[a.status] - PRIORIDADE[b.status] ||
        (b.periodoFim?.getTime() ?? 0) - (a.periodoFim?.getTime() ?? 0) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    if (!atual) return { plano: 'gratis', status: null, periodoFim: null, pagamentoPendente: null };

    // Pendente mostra o plano contratado (o front precisa dele para rotular a cobrança); as demais só enquanto há acesso.
    const comAcesso = atual.status === 'pendente' || (atual.periodoFim !== null && atual.periodoFim > agora);
    return {
      plano: comAcesso ? atual.plano : 'gratis',
      status: atual.status,
      periodoFim: atual.periodoFim?.toISOString() ?? null,
      pagamentoPendente: atual.status === 'pendente' ? await this.pagamentoPendente(userId, atual) : null,
    };
  }

  async assinar(userId: string, corpo: AssinarComCpf): Promise<ResultadoAssinatura> {
    // O lock cobre a chamada ao provedor: duplo clique não pode criar duas assinaturas cobrando.
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'assinatura:' + userId}, 0))`);

      const [usuario] = await tx.select().from(users).where(eq(users.id, userId));
      if (!usuario) throw new NotFoundException({ erro: 'nao_encontrado', mensagem: 'Usuário não encontrado.' });

      const vigentes = await tx
        .select()
        .from(subscriptions)
        .where(
          and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ['ativa', 'atrasada', 'pendente'])),
        );
      if (vigentes.some((s) => s.status !== 'pendente')) {
        throw new ConflictException({ erro: 'assinatura_ativa', mensagem: 'Você já tem uma assinatura ativa.' });
      }
      for (const pendente of vigentes) await this.abandonarPendente(tx, pendente);

      const resultado = await this.provider.criarAssinatura(
        {
          userId,
          email: usuario.email,
          nome: usuario.nome ?? undefined,
          cpfCnpj: corpo.cpfCnpj,
          providerCustomerId: usuario.providerCustomerId,
        },
        corpo.plano,
        corpo.metodo,
      );

      await tx
        .update(users)
        .set({ providerCustomerId: resultado.providerCustomerId, cpfCnpj: corpo.cpfCnpj })
        .where(eq(users.id, userId));
      await tx
        .insert(subscriptions)
        .values({ userId, plano: corpo.plano, status: 'pendente', providerSubId: resultado.providerSubId });
      return resultado;
    });
  }

  async cancelar(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'assinatura:' + userId}, 0))`);
      const cancelaveis = await tx
        .select()
        .from(subscriptions)
        .where(
          and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ['ativa', 'atrasada', 'pendente'])),
        )
        .orderBy(desc(subscriptions.createdAt));
      if (cancelaveis.length === 0) {
        throw new NotFoundException({ erro: 'assinatura_inexistente', mensagem: 'Nenhuma assinatura para cancelar.' });
      }
      for (const assinatura of cancelaveis) {
        if (assinatura.providerSubId) await this.provider.cancelarAssinatura(assinatura.providerSubId);
        await tx
          .update(subscriptions)
          .set({ status: 'cancelada', updatedAt: new Date() })
          .where(eq(subscriptions.id, assinatura.id));
      }
    });
  }

  private async abandonarPendente(tx: Parameters<Parameters<Db['transaction']>[0]>[0], pendente: SubscriptionRow) {
    if (pendente.providerSubId) {
      try {
        await this.provider.cancelarAssinatura(pendente.providerSubId);
      } catch (erro) {
        this.log.warn(`não foi possível cancelar a assinatura pendente ${pendente.providerSubId}: ${String(erro)}`);
      }
    }
    await tx
      .update(subscriptions)
      .set({ status: 'cancelada', updatedAt: new Date() })
      .where(eq(subscriptions.id, pendente.id));
  }

  private async pagamentoPendente(userId: string, assinatura: SubscriptionRow): Promise<ResultadoAssinatura | null> {
    if (!assinatura.providerSubId) return null;
    try {
      const dados = await this.provider.consultarPagamentoPendente(assinatura.providerSubId);
      if (!dados) return null;
      const [usuario] = await this.db.select().from(users).where(eq(users.id, userId));
      return {
        providerSubId: assinatura.providerSubId,
        providerCustomerId: usuario?.providerCustomerId ?? '',
        status: 'pendente',
        ...dados,
      };
    } catch (erro) {
      this.log.warn(`não foi possível consultar a cobrança pendente de ${assinatura.providerSubId}: ${String(erro)}`);
      return null;
    }
  }
}
