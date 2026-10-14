/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de teste sem tipo */
import { z } from 'zod';
import { CardSchema, RespostaGeracaoSchema } from '@cardify/shared';
import { paraJsonSchema } from './json-schema';

const PROIBIDAS = ['$schema', 'default', 'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'pattern', 'format'];

function chaves(no: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(no)) no.forEach((n) => chaves(n, acc));
  else if (typeof no === 'object' && no !== null) {
    for (const [k, v] of Object.entries(no)) {
      acc.add(k);
      if (k === 'properties') Object.values(v as object).forEach((n) => chaves(n, acc));
      else chaves(v, acc);
    }
  }
  return acc;
}

describe('paraJsonSchema', () => {
  it('CardSchema perde limites e fecha o objeto', () => {
    const s = paraJsonSchema(CardSchema) as any;
    const usadas = chaves(s);
    for (const p of PROIBIDAS) expect(usadas.has(p)).toBe(false);
    expect(s.type).toBe('object');
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['tipo', 'frente', 'verso', 'textoCloze', 'tagSecao', 'fonteOffset']);
    expect(s.properties.tipo.enum).toEqual(['basico', 'cloze']);
    expect(s.properties.frente).toEqual({ type: 'string' });
  });

  it('RespostaGeracaoSchema fecha objetos aninhados', () => {
    const s = paraJsonSchema(RespostaGeracaoSchema) as any;
    expect(chaves(s).has('minLength')).toBe(false);
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['cards']);
    expect(s.properties.cards.type).toBe('array');
    expect(s.properties.cards.items.additionalProperties).toBe(false);
    expect(s.properties.cards.items.required).toHaveLength(6);
  });

  it('não remove campos cujo nome coincide com palavra-chave', () => {
    const s = paraJsonSchema(z.object({ format: z.string().email(), default: z.number().min(1) })) as any;
    expect(Object.keys(s.properties)).toEqual(['format', 'default']);
    expect(s.properties.format).toEqual({ type: 'string' });
    expect(s.required).toEqual(['format', 'default']);
  });
});
