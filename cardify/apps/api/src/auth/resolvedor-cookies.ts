import { Inject, Injectable } from '@nestjs/common';
import { anonSessions, and, type Db, eq, isNull, sessions, sql } from '@cardify/db';
import type { FastifyRequest } from 'fastify';
import { DB } from '../infra/tokens';
import type { Dono, ResolvedorSessao } from '../sessao/dono';
import { COOKIE_ANON, COOKIE_SESSAO } from './constantes';
import { lerCookieAssinado } from './cookies';
import { ehUuid, sha256Hex } from './util';

/** Resolve o dono pelos cookies `cardify_sessao` (usuário) e `cardify_anon` (assinado). */
@Injectable()
export class ResolvedorSessaoCookies implements ResolvedorSessao {
  // Evita repetir consultas quando guard e controller resolvem a mesma requisição.
  private readonly porRequisicao = new WeakMap<object, Promise<Dono | null>>();

  constructor(@Inject(DB) private readonly db: Db) {}

  resolver(requisicao: unknown): Promise<Dono | null> {
    const chave = requisicao as FastifyRequest;
    let pendente = this.porRequisicao.get(chave);
    if (!pendente) {
      pendente = this.consultar(chave);
      this.porRequisicao.set(chave, pendente);
    }
    return pendente;
  }

  private async consultar(requisicao: FastifyRequest): Promise<Dono | null> {
    const token = requisicao.cookies?.[COOKIE_SESSAO];
    if (token) {
      const [sessao] = await this.db
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(and(eq(sessions.id, sha256Hex(token)), sql`${sessions.expiresAt} > ${new Date()}`));
      if (sessao) return { userId: sessao.userId, anonSessionId: null };
    }

    const anonId = lerCookieAssinado(requisicao, COOKIE_ANON);
    if (anonId && ehUuid(anonId)) {
      const [anonima] = await this.db
        .select({ id: anonSessions.id })
        .from(anonSessions)
        .where(and(eq(anonSessions.id, anonId), isNull(anonSessions.userId), sql`${anonSessions.expiresAt} > ${new Date()}`));
      if (anonima) return { userId: null, anonSessionId: anonima.id };
    }
    return null;
  }
}
