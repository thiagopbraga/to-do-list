import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { type Db, and, anonGastoDiario, anonSessions, eq, jobs, sql } from '@cardify/db';
import { type Env, LIMITES_ANONIMO } from '@cardify/shared';
import { DB, ENV } from '../infra/tokens';
import { VERIFICADOR_TURNSTILE } from './tokens';
import type { VerificadorTurnstile } from './turnstile';

export interface EstadoAnonimo {
  geracoesHoje: number;
  limiteDiario: number;
  exigeTurnstile: boolean;
  siteKey: string | null;
  disponivel: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntradaLimite {
  anonSessionId: string;
  ip: string | undefined;
  tokenTurnstile: string | undefined;
  idempotencyKey: string | undefined;
}

/**
 * Limites do fluxo anônimo (RFC §8.1) calculados direto no Postgres, no lugar do storage em memória
 * do `@nestjs/throttler`: a contagem é persistente e vale entre várias instâncias da API.
 *
 * Decisões:
 * - Dia = dia UTC (mesmo critério de `anon_gasto_diario`).
 * - O IP é identificado pelo `ip_hash` da sessão anônima (gravado na criação da sessão a partir de
 *   `request.ip`); a contagem soma jobs de TODAS as sessões com o mesmo `ip_hash`, então apagar o
 *   cookie não zera o limite. Jobs `falhou` também contam (o custo de LLM pode ter sido gasto).
 * - Repetição idempotente com `Idempotency-Key` que já resolve para um job do dono passa sem checagem.
 *   Repetição só pelo corpo (sem header) não é detectada aqui (o guard roda antes do serviço de jobs):
 *   se o limite já foi atingido, ela é bloqueada.
 * - Contagem e criação do job não são atômicas: requisições simultâneas da mesma origem podem
 *   ultrapassar o limite em poucas unidades. O teto global de gasto é a defesa de fundo.
 * - Atrás de proxy/CDN, `request.ip` só é o IP do cliente com `trustProxy` habilitado no
 *   `FastifyAdapter` (ex.: `new FastifyAdapter({ trustProxy: true })` ou lista de proxies confiáveis).
 *   Não ativado aqui: ativar sem proxy real permite forjar `X-Forwarded-For`.
 */
@Injectable()
export class AnonimoService {
  private readonly logger = new Logger(AnonimoService.name);
  private diaAlertado: string | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(VERIFICADOR_TURNSTILE) private readonly verificador: VerificadorTurnstile,
  ) {}

  async estado(anonSessionId: string): Promise<EstadoAnonimo> {
    const geracoesHoje = await this.geracoesDoIp(anonSessionId);
    const limiteDiario = LIMITES_ANONIMO.geracoesPorIpPorDia;
    const noLimite = geracoesHoje >= limiteDiario;
    return {
      geracoesHoje,
      limiteDiario,
      exigeTurnstile: !noLimite && this.exigeTurnstile(geracoesHoje),
      siteKey: this.env.TURNSTILE_SITE_KEY ?? null,
      disponivel: !noLimite && !(await this.tetoAtingido()),
    };
  }

  async verificar(entrada: EntradaLimite): Promise<void> {
    if (!UUID.test(entrada.anonSessionId)) return;
    if (await this.repeticaoIdempotente(entrada)) return;

    if (await this.tetoAtingido(true)) {
      throw new ServiceUnavailableException({
        erro: 'amostra_indisponivel',
        mensagem: 'A geração gratuita está temporariamente indisponível. Entre para continuar.',
      });
    }

    const geracoesHoje = await this.geracoesDoIp(entrada.anonSessionId);
    if (geracoesHoje >= LIMITES_ANONIMO.geracoesPorIpPorDia) {
      throw new HttpException(
        {
          erro: 'limite_diario_ip',
          mensagem: `Limite de ${LIMITES_ANONIMO.geracoesPorIpPorDia} gerações gratuitas por dia atingido. Entre para continuar.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.exigeTurnstile(geracoesHoje) && !(await this.turnstileValido(entrada))) {
      throw new ForbiddenException({
        erro: 'turnstile_necessario',
        mensagem: 'Confirme que você não é um robô para continuar.',
        siteKey: this.env.TURNSTILE_SITE_KEY ?? null,
      });
    }
  }

  private exigeTurnstile(geracoesHoje: number): boolean {
    return geracoesHoje + 1 >= LIMITES_ANONIMO.turnstileAPartirDe;
  }

  private async turnstileValido(entrada: EntradaLimite): Promise<boolean> {
    if (!this.env.TURNSTILE_SECRET) return this.env.NODE_ENV !== 'production';
    if (!entrada.tokenTurnstile) return false;
    return this.verificador.verificar(entrada.tokenTurnstile, entrada.ip);
  }

  private async repeticaoIdempotente({ anonSessionId, idempotencyKey }: EntradaLimite): Promise<boolean> {
    const chaveCliente = idempotencyKey?.trim();
    if (!chaveCliente) return false;
    // Mesma composição de chave de JobsService.criar; job `falhou` gera um novo job, então não é repetição.
    const [existente] = await this.db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.idempotencyKey, `${anonSessionId}:${chaveCliente}`))
      .limit(1);
    return !!existente && existente.status !== 'falhou';
  }

  private async geracoesDoIp(anonSessionId: string): Promise<number> {
    if (!UUID.test(anonSessionId)) return 0;
    const [sessao] = await this.db
      .select({ ipHash: anonSessions.ipHash })
      .from(anonSessions)
      .where(eq(anonSessions.id, anonSessionId))
      .limit(1);
    if (!sessao) return 0;
    const [linha] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(jobs)
      .innerJoin(anonSessions, eq(jobs.anonSessionId, anonSessions.id))
      .where(and(eq(anonSessions.ipHash, sessao.ipHash), sql`${jobs.createdAt} >= ${inicioDoDiaUtc().toISOString()}::timestamptz`));
    return linha?.total ?? 0;
  }

  /** Com `alertar`, registra erro (alerta) na primeira detecção do dia por instância. */
  private async tetoAtingido(alertar = false): Promise<boolean> {
    const dia = diaUtc();
    const [linha] = await this.db
      .select({ gasto: sql<number>`coalesce(sum(${anonGastoDiario.gastoCentavos}), 0)::float8` })
      .from(anonGastoDiario)
      .where(eq(anonGastoDiario.dia, dia));
    const gasto = linha?.gasto ?? 0;
    const atingido = gasto >= this.env.ANON_TETO_DIARIO_CENTAVOS;
    if (atingido && alertar && this.diaAlertado !== dia) {
      this.diaAlertado = dia;
      this.logger.error(
        `Teto diário de gasto anônimo atingido em ${dia}: ${gasto} centavos gastos de ${this.env.ANON_TETO_DIARIO_CENTAVOS}. Geração anônima desligada até 00:00 UTC.`,
      );
    }
    return atingido;
  }
}

function diaUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function inicioDoDiaUtc(): Date {
  return new Date(`${diaUtc()}T00:00:00.000Z`);
}
