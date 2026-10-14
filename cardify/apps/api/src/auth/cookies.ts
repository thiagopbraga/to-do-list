import '@fastify/cookie';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { Env } from '@cardify/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function opcoesCookie(env: Env, maxAgeSegundos: number, assinado = false): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSegundos,
    ...(assinado ? { signed: true } : {}),
  };
}

export function limparCookies(reply: FastifyReply, ...nomes: string[]): void {
  for (const nome of nomes) void reply.clearCookie(nome, { path: '/' });
}

/** Valor de um cookie assinado, ou null se ausente ou com assinatura inválida. */
export function lerCookieAssinado(requisicao: FastifyRequest, nome: string): string | null {
  const bruto = requisicao.cookies?.[nome];
  if (!bruto) return null;
  const resultado = requisicao.unsignCookie(bruto);
  return resultado.valid ? resultado.value : null;
}
