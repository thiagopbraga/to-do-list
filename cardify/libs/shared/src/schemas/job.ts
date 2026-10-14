import { z } from 'zod';

export const DensidadeSchema = z.enum(['enxuto', 'equilibrado', 'exaustivo']);
export type Densidade = z.infer<typeof DensidadeSchema>;

/** ≈ cards por parágrafo relevante (PRD RF-03/04). */
export const CARDS_POR_PARAGRAFO: Record<Densidade, number> = {
  enxuto: 1,
  equilibrado: 2,
  exaustivo: 4,
};

export const TipoGeracaoSchema = z.enum(['basico', 'cloze', 'misto']);
export type TipoGeracao = z.infer<typeof TipoGeracaoSchema>;

export const AreaSchema = z.enum(['medicina', 'direito', 'exatas', 'geral']);
export type Area = z.infer<typeof AreaSchema>;

export const ParametrosGeracaoSchema = z.object({
  densidade: DensidadeSchema.default('equilibrado'),
  tipo: TipoGeracaoSchema.default('misto'),
  area: AreaSchema.default('geral'),
});
export type ParametrosGeracao = z.infer<typeof ParametrosGeracaoSchema>;

export const JobStatusSchema = z.enum([
  'pendente',
  'ingerindo',
  'gerando',
  'empacotando',
  'concluido',
  'parcial',
  'falhou',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;
export const JOB_STATUS_FINAIS: readonly JobStatus[] = ['concluido', 'parcial', 'falhou'];

export const EstagioSchema = z.enum(['ingestao', 'geracao', 'empacotamento']);
export type Estagio = z.infer<typeof EstagioSchema>;

/** Corpo de POST /v1/jobs. Exatamente um entre `documentId` e `texto`. */
export const CriarJobSchema = z
  .object({
    documentId: z.string().uuid().optional(),
    texto: z.string().min(50).max(50_000).optional(),
    nome: z.string().max(200).optional(),
    parametros: ParametrosGeracaoSchema,
    /** true = amostra (até 10 cards), usada no fluxo anônimo e na landing. */
    amostra: z.boolean().default(false),
  })
  .refine((v) => (v.documentId ? !v.texto : !!v.texto), {
    message: 'informe documentId OU texto',
  });
export type CriarJob = z.infer<typeof CriarJobSchema>;

/** Evento de progresso publicado pelo worker e entregue por SSE. */
export const ProgressoEventoSchema = z.object({
  jobId: z.string().uuid(),
  status: JobStatusSchema,
  estagio: EstagioSchema.nullable(),
  /** 0..100 */
  percentual: z.number().min(0).max(100),
  cardsGerados: z.number().int().nonnegative(),
  mensagem: z.string().optional(),
});
export type ProgressoEvento = z.infer<typeof ProgressoEventoSchema>;

export const JobResumoSchema = z.object({
  id: z.string().uuid(),
  status: JobStatusSchema,
  cardsGerados: z.number().int().nonnegative(),
  custoCentavos: z.number().int().nonnegative(),
  erro: z.string().nullable(),
  nome: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type JobResumo = z.infer<typeof JobResumoSchema>;

export const ExportFormatoSchema = z.enum(['apkg', 'csv', 'tsv']);
export type ExportFormato = z.infer<typeof ExportFormatoSchema>;

export const CriarExportSchema = z.object({
  jobId: z.string().uuid(),
  formato: ExportFormatoSchema,
});
export type CriarExport = z.infer<typeof CriarExportSchema>;
