import { Inject, Injectable } from '@nestjs/common';
import { anonSessions, and, type Db, documents, eq, isNull, jobs, sessions, sql } from '@cardify/db';
import { type Env, LIMITES_ANONIMO } from '@cardify/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DB, ENV } from '../infra/tokens';
import { COOKIE_ANON, COOKIE_SESSAO, SESSAO_TTL_SEGUNDOS } from './constantes';
import { lerCookieAssinado, limparCookies, opcoesCookie } from './cookies';
import { ehUuid, sha256Hex, tokenAleatorio } from './util';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class SessoesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async criarAnonima(requisicao: FastifyRequest, resposta: FastifyReply): Promise<void> {
    const ipHash = sha256Hex(requisicao.ip + this.env.SESSION_SECRET);
    const [anonima] = await this.db
      .insert(anonSessions)
      .values({ ipHash, expiresAt: new Date(Date.now() + LIMITES_ANONIMO.sessaoTtlSegundos * 1000) })
      .returning({ id: anonSessions.id });
    void resposta.setCookie(COOKIE_ANON, anonima.id, opcoesCookie(this.env, LIMITES_ANONIMO.sessaoTtlSegundos, true));
  }

  /** Cria a sessão do usuário, vincula o trabalho anônimo (se houver) e troca os cookies. */
  async concluirLogin(requisicao: FastifyRequest, resposta: FastifyReply, userId: string): Promise<void> {
    const anonId = lerCookieAssinado(requisicao, COOKIE_ANON);
    const tokenAnterior = requisicao.cookies?.[COOKIE_SESSAO];
    const token = tokenAleatorio();

    await this.db.transaction(async (tx) => {
      await tx.insert(sessions).values({
        id: sha256Hex(token),
        userId,
        expiresAt: new Date(Date.now() + SESSAO_TTL_SEGUNDOS * 1000),
      });
      if (anonId && ehUuid(anonId)) await this.vincularTrabalhoAnonimo(tx, anonId, userId);
    });
    if (tokenAnterior) await this.db.delete(sessions).where(eq(sessions.id, sha256Hex(tokenAnterior)));

    void resposta.setCookie(COOKIE_SESSAO, token, opcoesCookie(this.env, SESSAO_TTL_SEGUNDOS));
    limparCookies(resposta, COOKIE_ANON);
  }

  async encerrar(requisicao: FastifyRequest, resposta: FastifyReply): Promise<void> {
    const token = requisicao.cookies?.[COOKIE_SESSAO];
    if (token) await this.db.delete(sessions).where(eq(sessions.id, sha256Hex(token)));
    limparCookies(resposta, COOKIE_SESSAO, COOKIE_ANON);
  }

  /**
   * Passa documentos e jobs da sessão anônima para o usuário (RFC §8.1). Cada UPDATE troca
   * `user_id` e `anon_session_id` juntos por causa do CHECK de dono único. Não toca na cota:
   * jobs de amostra não a consomem.
   */
  private async vincularTrabalhoAnonimo(tx: Tx, anonId: string, userId: string): Promise<void> {
    const vinculadas = await tx
      .update(anonSessions)
      .set({ userId })
      .where(and(eq(anonSessions.id, anonId), isNull(anonSessions.userId), sql`${anonSessions.expiresAt} > ${new Date()}`))
      .returning({ id: anonSessions.id });
    if (vinculadas.length === 0) return;

    await tx.update(documents).set({ userId, anonSessionId: null }).where(eq(documents.anonSessionId, anonId));
    await tx.update(jobs).set({ userId, anonSessionId: null }).where(eq(jobs.anonSessionId, anonId));
  }
}
