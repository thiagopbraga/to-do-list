import { z } from 'zod';

export const PlanoSchema = z.enum(['gratis', 'essencial', 'ilimitado', 'anual']);
export type Plano = z.infer<typeof PlanoSchema>;

export interface DefinicaoPlano {
  nome: string;
  precoCentavos: number;
  periodicidade: 'mensal' | 'anual' | 'nenhuma';
  /** Cota de cards gerados por ciclo mensal (PRD §10). */
  cotaCardsMes: number;
  ocr: boolean;
  questoes: boolean;
}

export const PLANOS: Record<Plano, DefinicaoPlano> = {
  gratis: { nome: 'Grátis', precoCentavos: 0, periodicidade: 'nenhuma', cotaCardsMes: 30, ocr: false, questoes: false },
  essencial: { nome: 'Essencial', precoCentavos: 2490, periodicidade: 'mensal', cotaCardsMes: 1500, ocr: false, questoes: false },
  ilimitado: { nome: 'Ilimitado', precoCentavos: 4490, periodicidade: 'mensal', cotaCardsMes: 10_000, ocr: true, questoes: true },
  anual: { nome: 'Anual', precoCentavos: 24_900, periodicidade: 'anual', cotaCardsMes: 1500, ocr: false, questoes: false },
};

export const MetodoPagamentoSchema = z.enum(['pix', 'cartao', 'boleto']);
export type MetodoPagamento = z.infer<typeof MetodoPagamentoSchema>;

export const AssinarSchema = z.object({
  plano: PlanoSchema.exclude(['gratis']),
  metodo: MetodoPagamentoSchema,
});
export type Assinar = z.infer<typeof AssinarSchema>;
