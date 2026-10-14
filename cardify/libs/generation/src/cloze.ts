import { naoImplementado } from '@cardify/shared';

export type MotivoClozeInvalido =
  | 'sem_oclusao'
  | 'indices_nao_contiguos'
  | 'oclusao_vazia'
  | 'oclusao_frase_inteira'
  | 'chaves_desbalanceadas'
  | 'pouco_contexto';

export type ResultadoCloze = { ok: true; indices: number[] } | { ok: false; motivo: MotivoClozeInvalido };

/** T08 — valida cloze conforme RFC §4.3. `indices` = índices distintos em ordem crescente. */
export function validarCloze(_texto: string): ResultadoCloze {
  naoImplementado('T08');
}

/** T08 — texto sem marcação: `{{c1::Aorta::dica}}` → `Aorta`. */
export function removerMarcacaoCloze(_texto: string): string {
  naoImplementado('T08');
}
