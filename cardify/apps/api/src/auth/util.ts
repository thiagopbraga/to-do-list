import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256Hex = (valor: string): string => createHash('sha256').update(valor).digest('hex');

/** 32 bytes aleatórios em base64url: o próprio valor é o segredo (cookie de sessão, token de magic link). */
export const tokenAleatorio = (): string => randomBytes(32).toString('base64url');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (valor: string): boolean => UUID.test(valor);

export function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Só caminho relativo do próprio app; qualquer outra coisa vira `/` (evita open redirect). */
export function retornoSeguro(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length > 512) return '/';
  if (!valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(valor)) return '/';
  return valor;
}

export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

export function urlDoApp(appUrl: string, caminho: string): string {
  return `${appUrl.replace(/\/+$/, '')}${caminho}`;
}
