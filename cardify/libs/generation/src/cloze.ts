import { CLOZE_MIN_CONTEXTO_CHARS, CLOZE_REGEX } from '@cardify/shared';

export type MotivoClozeInvalido =
  | 'sem_oclusao'
  | 'indices_nao_contiguos'
  | 'oclusao_vazia'
  | 'oclusao_frase_inteira'
  | 'chaves_desbalanceadas'
  | 'pouco_contexto';

export type ResultadoCloze = { ok: true; indices: number[] } | { ok: false; motivo: MotivoClozeInvalido };

const PADRAO_OCLUSAO = CLOZE_REGEX;

function normalizar(texto: string): string {
  return texto
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\s.!?;:…]+$/, '');
}

/** T08 — valida cloze conforme RFC §4.3. `indices` = índices distintos em ordem crescente. */
export function validarCloze(texto: string): ResultadoCloze {
  const abertas = texto.split('{{').length - 1;
  const fechadas = texto.split('}}').length - 1;
  const oclusoes = [...texto.matchAll(PADRAO_OCLUSAO)];

  if (abertas !== fechadas || /[{}]/.test(texto.replace(PADRAO_OCLUSAO, ''))) {
    return { ok: false, motivo: 'chaves_desbalanceadas' };
  }
  if (oclusoes.length === 0) {
    return { ok: false, motivo: 'sem_oclusao' };
  }
  if (oclusoes.some((m) => m[2].trim() === '')) {
    return { ok: false, motivo: 'oclusao_vazia' };
  }

  const indices = [...new Set(oclusoes.map((m) => Number(m[1])))].sort((a, b) => a - b);
  if (indices.some((indice, posicao) => indice !== posicao + 1)) {
    return { ok: false, motivo: 'indices_nao_contiguos' };
  }

  const conteudoOcluido = oclusoes.map((m) => m[2]).join(' ');
  if (normalizar(conteudoOcluido) === normalizar(removerMarcacaoCloze(texto))) {
    return { ok: false, motivo: 'oclusao_frase_inteira' };
  }

  const contexto = texto.replace(PADRAO_OCLUSAO, ' ').replace(/\s+/g, ' ').trim();
  if (contexto.length < CLOZE_MIN_CONTEXTO_CHARS) {
    return { ok: false, motivo: 'pouco_contexto' };
  }

  return { ok: true, indices };
}

/** T08 — texto sem marcação: `{{c1::Aorta::dica}}` → `Aorta`. */
export function removerMarcacaoCloze(texto: string): string {
  return texto.replace(PADRAO_OCLUSAO, (_marcacao, _indice: string, conteudo: string) => conteudo);
}
