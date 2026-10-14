import { createHash, timingSafeEqual } from 'node:crypto';

/** Comparação em tempo constante; o hash prévio evita vazar o tamanho e permite tamanhos diferentes. */
export function segredosIguais(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function cabecalho(headers: Record<string, string | string[] | undefined>, nome: string): string | undefined {
  const alvo = nome.toLowerCase();
  for (const [chave, valor] of Object.entries(headers)) {
    if (chave.toLowerCase() === alvo) return Array.isArray(valor) ? valor[0] : valor;
  }
  return undefined;
}
