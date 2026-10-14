import type { ZodError, ZodType, ZodTypeDef } from 'zod';
import {
  RespostaLlmInvalidaError,
  type ContextoChamadaLlm,
  type LlmCliente,
  type LlmRequisicao,
} from '@cardify/shared';
import { paraJsonSchema } from './json-schema';

const SISTEMA_REPARO = 'Você corrige JSON. Responda apenas com o JSON corrigido.';

type Tentativa<T> = { ok: true; valor: T } | { ok: false; erros: string };

function extrairJson(texto: string): string {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  return inicio >= 0 && fim > inicio ? texto.slice(inicio, fim + 1) : texto;
}

function descreverIssues(erro: ZodError): string {
  return erro.issues.map((i) => `- ${i.path.join('.') || '(raiz)'}: ${i.message}`).join('\n');
}

function validar<T>(texto: string, schema: ZodType<T, ZodTypeDef, unknown>): Tentativa<T> {
  let json: unknown;
  try {
    json = JSON.parse(extrairJson(texto));
  } catch (erro) {
    return { ok: false, erros: `- JSON inválido: ${(erro as Error).message}` };
  }
  const resultado = schema.safeParse(json);
  return resultado.success ? { ok: true, valor: resultado.data } : { ok: false, erros: descreverIssues(resultado.error) };
}

/** Chama o LLM, valida com zod e faz UMA tentativa de reparo (RFC §4.2); depois lança RespostaLlmInvalidaError. */
export async function chamarEstruturado<T>(
  cliente: LlmCliente,
  ctx: ContextoChamadaLlm,
  req: LlmRequisicao,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<{ valor: T; reparado: boolean }> {
  const jsonSchema = req.jsonSchema ?? paraJsonSchema(schema);
  const resposta = await cliente.chamar(ctx, { ...req, jsonSchema });

  const primeira = validar(resposta.texto, schema);
  if (primeira.ok) return { valor: primeira.valor, reparado: false };

  const reparo = await cliente.chamar(
    { ...ctx, estagio: 'reparo' },
    {
      tier: req.tier,
      sistema: SISTEMA_REPARO,
      mensagens: [
        {
          papel: 'user',
          conteudo: `JSON com defeito:\n${resposta.texto}\n\nErros:\n${primeira.erros}`,
        },
      ],
      maxTokens: req.maxTokens,
      jsonSchema,
    },
  );

  const segunda = validar(reparo.texto, schema);
  if (segunda.ok) return { valor: segunda.valor, reparado: true };

  throw new RespostaLlmInvalidaError(
    `resposta do LLM inválida após reparo:\n${segunda.erros}`,
    reparo.texto,
  );
}
