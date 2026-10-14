import type { Dono, ResolvedorSessao } from './dono';

/** Placeholder até a autenticação (T21): nenhuma sessão é reconhecida. */
export class ResolvedorSessaoPendente implements ResolvedorSessao {
  async resolver(): Promise<Dono | null> {
    return null;
  }
}
