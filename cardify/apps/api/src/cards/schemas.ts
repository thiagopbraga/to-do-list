import { z } from 'zod';

export const ListarCardsSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(500).default(100),
  incluirDescartados: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
});
export type ListarCards = z.output<typeof ListarCardsSchema>;

export const AcaoLoteSchema = z.enum(['descartar', 'restaurar', 'adicionarTags', 'removerTags']);

export const LoteCardsSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    acao: AcaoLoteSchema,
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  })
  .refine((v) => (v.acao !== 'adicionarTags' && v.acao !== 'removerTags') || (v.tags?.length ?? 0) > 0, {
    message: 'informe ao menos uma tag',
    path: ['tags'],
  });
export type LoteCards = z.output<typeof LoteCardsSchema>;

export const OrdemCardsSchema = z.object({
  ids: z.array(z.string().uuid()).max(10_000),
});
export type OrdemCards = z.output<typeof OrdemCardsSchema>;
