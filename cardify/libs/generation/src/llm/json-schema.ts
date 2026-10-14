import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** Palavras-chave fora do subconjunto aceito por saída estruturada; o zod revalida os limites depois. */
const PALAVRAS_REMOVIDAS = new Set([
  '$schema',
  'default',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'pattern',
  'format',
]);

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function simplificar(no: unknown): unknown {
  if (Array.isArray(no)) return no.map(simplificar);
  if (!ehObjeto(no)) return no;

  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(no)) {
    if (PALAVRAS_REMOVIDAS.has(chave)) continue;
    if (chave === 'properties' && ehObjeto(valor)) {
      // Chaves de `properties` são nomes de campos, não palavras-chave: não filtrar.
      saida[chave] = Object.fromEntries(Object.entries(valor).map(([nome, sub]) => [nome, simplificar(sub)]));
    } else {
      saida[chave] = simplificar(valor);
    }
  }

  if (ehObjeto(saida['properties'])) {
    saida['additionalProperties'] = false;
    saida['required'] = Object.keys(saida['properties']);
  }
  return saida;
}

export function paraJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const bruto = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' });
  return simplificar(bruto) as Record<string, unknown>;
}
