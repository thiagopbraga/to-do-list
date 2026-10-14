import type { Dono, ResolvedorSessao } from './dono';

/**
 * Só para testes: lê `x-teste-user` / `x-teste-anon` dos headers.
 * Use com `overrideProvider(RESOLVEDOR_SESSAO).useValue(new ResolvedorSessaoTeste())`.
 */
export class ResolvedorSessaoTeste implements ResolvedorSessao {
  async resolver(requisicao: unknown): Promise<Dono | null> {
    const headers = (requisicao as { headers: Record<string, string | undefined> }).headers;
    const userId = headers['x-teste-user'] ?? null;
    const anonSessionId = headers['x-teste-anon'] ?? null;
    return userId || anonSessionId ? { userId, anonSessionId } : null;
  }
}
