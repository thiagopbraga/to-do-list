import type { ParametrosGeracao } from '@cardify/shared';

/**
 * O que o front precisa lembrar de um job para oferecer "Gerar o baralho completo" depois do login.
 * Fica no sessionStorage da aba (sobrevive ao retorno do OAuth na mesma aba), nunca vai ao servidor.
 */
export interface ContextoJob {
  amostra: boolean;
  parametros: ParametrosGeracao;
  documentId?: string;
  texto?: string;
}

const chave = (jobId: string) => `cardify:job:${jobId}`;

export function guardarContextoJob(jobId: string, contexto: ContextoJob): void {
  try {
    sessionStorage.setItem(chave(jobId), JSON.stringify(contexto));
  } catch {
    // storage cheio ou bloqueado: o botão de gerar o baralho completo simplesmente não aparece
  }
}

export function lerContextoJob(jobId: string): ContextoJob | null {
  try {
    const bruto = sessionStorage.getItem(chave(jobId));
    return bruto ? (JSON.parse(bruto) as ContextoJob) : null;
  } catch {
    return null;
  }
}
