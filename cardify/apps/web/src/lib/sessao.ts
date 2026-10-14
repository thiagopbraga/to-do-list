import { api } from './api';

export interface UsuarioSessao {
  id: string;
  email: string;
  nome: string | null;
}

/** Resposta de `GET /v1/me`. `anonimo` indica sessão anônima sem conta. */
export interface Me {
  usuario: UsuarioSessao | null;
  anonimo: boolean;
}

/** Resposta de `GET /v1/anonimo/estado`. */
export interface EstadoAnonimo {
  geracoesHoje: number;
  limiteDiario: number;
  exigeTurnstile: boolean;
  siteKey: string | null;
  disponivel: boolean;
}

export const obterMe = () => api<Me>('/me');

export const obterEstadoAnonimo = () => api<EstadoAnonimo>('/anonimo/estado');

/** Garante cookie de sessão antes de enviar material: logado ou anônimo. */
export async function garantirSessao(): Promise<Me> {
  const me = await obterMe();
  if (me.usuario || me.anonimo) return me;
  await api<void>('/sessao/anonima', { metodo: 'POST' });
  return { usuario: null, anonimo: true };
}
