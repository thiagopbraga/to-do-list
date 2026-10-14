import type { Assinar, Plano, ResultadoAssinatura } from '@cardify/shared';
import { api } from './api';

export interface UsuarioConta {
  id: string;
  email: string;
  nome: string | null;
}

export interface SessaoConta {
  usuario: UsuarioConta | null;
  anonimo: boolean;
}

export type StatusAssinatura = 'ativa' | 'pendente' | 'atrasada' | 'cancelada';

export interface AssinaturaConta {
  plano: Plano;
  status: StatusAssinatura | null;
  periodoFim: string | null;
  pagamentoPendente: ResultadoAssinatura | null;
}

export type NovaAssinatura = Assinar & { cpfCnpj: string };

export const obterSessao = () => api<SessaoConta>('/me');

export const pedirLinkDeAcesso = (email: string, retorno: string) =>
  api<void>('/auth/email', { corpo: { email, retorno } });

export const sairDaConta = () => api<void>('/auth/sair', { metodo: 'POST' });

export const excluirConta = () => api<void>('/conta', { metodo: 'DELETE' });

export const obterAssinatura = () => api<AssinaturaConta>('/assinatura');

export const assinarPlano = (corpo: NovaAssinatura) => api<ResultadoAssinatura>('/assinaturas', { corpo });

export const cancelarAssinatura = () => api<void>('/assinatura', { metodo: 'DELETE' });
