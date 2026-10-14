import { UnprocessableEntityException } from '@nestjs/common';
import { removerMarcacaoCloze, validarCloze } from '@cardify/generation';
import type { CardTipo } from '@cardify/shared';

export interface ConteudoFechado {
  tipo: CardTipo;
  frente: string;
  verso: string;
  textoCloze: string | null;
}

/**
 * Conteúdo final de um card. Cloze exige oclusão válida (RFC §4.3); básico não guarda textoCloze.
 * `frente` ausente: básico mantém a atual; cloze deriva do textoCloze.
 */
export function fecharConteudo(entrada: {
  tipo: CardTipo;
  frente: string | undefined;
  frenteAtual: string;
  verso: string;
  textoCloze: string | null;
}): ConteudoFechado {
  if (entrada.tipo === 'basico') {
    return { tipo: 'basico', frente: entrada.frente ?? entrada.frenteAtual, verso: entrada.verso, textoCloze: null };
  }
  const textoCloze = entrada.textoCloze;
  if (textoCloze === null || textoCloze.trim() === '') {
    throw new UnprocessableEntityException({ erro: 'cloze_invalido', motivo: 'texto_cloze_ausente' });
  }
  const resultado = validarCloze(textoCloze);
  if (!resultado.ok) {
    throw new UnprocessableEntityException({ erro: 'cloze_invalido', motivo: resultado.motivo });
  }
  return {
    tipo: 'cloze',
    frente: entrada.frente ?? removerMarcacaoCloze(textoCloze),
    verso: entrada.verso,
    textoCloze,
  };
}
