import type { ZodType, ZodTypeDef } from 'zod';
import { naoImplementado, type ContextoChamadaLlm, type LlmCliente, type LlmRequisicao } from '@cardify/shared';

/** T10 — chama o LLM, valida com zod e faz UMA tentativa de reparo; depois lança RespostaLlmInvalidaError. */
export async function chamarEstruturado<T>(
  _cliente: LlmCliente,
  _ctx: ContextoChamadaLlm,
  _req: LlmRequisicao,
  _schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<{ valor: T; reparado: boolean }> {
  naoImplementado('T10');
}
