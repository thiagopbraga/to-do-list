import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { RequisicaoComDono } from '../sessao/dono';
import { AnonimoService } from './anonimo.service';

/** Aplica os limites do fluxo anônimo (RFC §8.1). Não faz nada para usuário logado. */
@Injectable()
export class LimiteAnonimoGuard implements CanActivate {
  constructor(private readonly anonimo: AnonimoService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requisicao = ctx.switchToHttp().getRequest<FastifyRequest & RequisicaoComDono>();
    const dono = requisicao.dono;
    if (!dono || dono.userId || !dono.anonSessionId) return true;

    await this.anonimo.verificar({
      anonSessionId: dono.anonSessionId,
      ip: requisicao.ip,
      tokenTurnstile: cabecalho(requisicao.headers['x-turnstile-token']),
      idempotencyKey: cabecalho(requisicao.headers['idempotency-key']),
    });
    return true;
  }
}

function cabecalho(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
