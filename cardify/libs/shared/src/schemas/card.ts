import { z } from 'zod';

export const CardTipoSchema = z.enum(['basico', 'cloze']);
export type CardTipo = z.infer<typeof CardTipoSchema>;

/**
 * Card como sai do LLM (estágio B). Mesmo schema usado pelo front (RFC §4.2).
 * Para cloze: `textoCloze` contém o texto com `{{c1::...}}`; `frente`/`verso` ficam como
 * resumo legível (frente = textoCloze sem marcação, verso = conteúdo ocluído).
 */
export const CardSchema = z.object({
  tipo: CardTipoSchema,
  frente: z.string().min(3).max(300),
  verso: z.string().min(1).max(500),
  textoCloze: z.string().nullable(),
  tagSecao: z.string(),
  fonteOffset: z.number().int().nonnegative(),
});
export type Card = z.infer<typeof CardSchema>;

export const RespostaGeracaoSchema = z.object({ cards: z.array(CardSchema) });
export type RespostaGeracao = z.infer<typeof RespostaGeracaoSchema>;

/** Estágio A: afirmações atômicas extraídas de um chunk (RFC §4.1). */
export const FatoCategoriaSchema = z.enum(['definicao', 'enumeracao', 'relacao', 'numero', 'processo']);
export type FatoCategoria = z.infer<typeof FatoCategoriaSchema>;

export const FatoSchema = z.object({
  afirmacao: z.string().min(3),
  categoria: FatoCategoriaSchema,
  fonteOffset: z.number().int().nonnegative(),
});
export type Fato = z.infer<typeof FatoSchema>;

export const RespostaExtracaoSchema = z.object({ fatos: z.array(FatoSchema) });
export type RespostaExtracao = z.infer<typeof RespostaExtracaoSchema>;

export const CardEstadoSchema = z.enum(['gerado', 'editado', 'descartado']);
export type CardEstado = z.infer<typeof CardEstadoSchema>;

/** Card persistido, como a API devolve para a tela de revisão. */
export const CardRevisaoSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  chunkId: z.string().uuid().nullable(),
  tipo: CardTipoSchema,
  frente: z.string(),
  verso: z.string(),
  textoCloze: z.string().nullable(),
  tags: z.array(z.string()),
  trilhaTitulos: z.array(z.string()),
  fonteOffset: z.number().int().nonnegative(),
  estado: CardEstadoSchema,
  ordem: z.number().int().nonnegative(),
});
export type CardRevisao = z.infer<typeof CardRevisaoSchema>;

export const EditarCardSchema = z
  .object({
    tipo: CardTipoSchema.optional(),
    frente: z.string().min(1).max(300).optional(),
    verso: z.string().min(1).max(500).optional(),
    textoCloze: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    ordem: z.number().int().nonnegative().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'nenhum campo para editar' });
export type EditarCard = z.infer<typeof EditarCardSchema>;
