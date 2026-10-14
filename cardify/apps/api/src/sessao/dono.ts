import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Quem é dono do recurso na requisição: usuário logado ou sessão anônima (RFC §8.1). */
export interface Dono {
  userId: string | null;
  anonSessionId: string | null;
}

export interface RequisicaoComDono {
  dono?: Dono;
}

/** Resolve a sessão a partir da requisição (cookie). Implementado pela autenticação (T21). */
export interface ResolvedorSessao {
  resolver(requisicao: unknown): Promise<Dono | null>;
}

export const DonoAtual = createParamDecorator((_dados: unknown, ctx: ExecutionContext): Dono => {
  const requisicao = ctx.switchToHttp().getRequest<RequisicaoComDono>();
  if (!requisicao.dono) throw new Error('rota sem SessaoGuard: dono ausente');
  return requisicao.dono;
});

export function mesmoDono(dono: Dono, recurso: { userId: string | null; anonSessionId: string | null }): boolean {
  if (dono.userId) return recurso.userId === dono.userId;
  return !!dono.anonSessionId && recurso.anonSessionId === dono.anonSessionId;
}
