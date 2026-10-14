// Frente e verso vão como HTML (#html:true): & < > viram entidades e quebras de linha viram <br>.
// Campos que contêm o separador ou aspas vão entre aspas duplas (RFC 4180), também no TSV.
import {
  CardifyError,
  NOTE_TYPE_NOME_BASICO,
  NOTE_TYPE_NOME_CLOZE,
  type NotaExportavel,
  type PacoteBaralho,
} from '@cardify/shared';
import { nomeDeckDaNota, tagsDaNota } from './tags';

/** T14 — exportação CSV/TSV importável no Anki/AnkiDroid (RF-07). */
export function exportarDelimitado(pacote: PacoteBaralho, separador: ',' | '\t'): string {
  const cabecalho = [
    `#separator:${separador === '\t' ? 'Tab' : 'Comma'}`,
    '#html:true',
    '#notetype column:1',
    '#deck column:2',
    '#tags column:5',
    `#columns:${['Note type', 'Deck', 'Front/Text', 'Back', 'Tags'].join(separador)}`,
  ];
  const notas = [...pacote.notas].sort((a, b) => a.ordem - b.ordem);
  const linhas = notas.map((nota) => montarLinha(pacote, nota, separador));
  return [...cabecalho, ...linhas].map((linha) => `${linha}\n`).join('');
}

function montarLinha(pacote: PacoteBaralho, nota: NotaExportavel, separador: ',' | '\t'): string {
  const cloze = nota.tipo === 'cloze';
  const frente = cloze ? textoClozeObrigatorio(nota) : nota.frente;
  const verso = cloze ? '' : nota.verso;
  const colunas = [
    cloze ? NOTE_TYPE_NOME_CLOZE : NOTE_TYPE_NOME_BASICO,
    nomeDeckDaNota(pacote.nomeBaralho, nota.trilhaTitulos),
    escaparHtml(frente),
    escaparHtml(verso),
    tagsDaNota(pacote.slugDocumento, nota.trilhaTitulos, nota.tags).join(' '),
  ];
  return colunas.map((coluna) => campo(coluna, separador)).join(separador);
}

function textoClozeObrigatorio(nota: NotaExportavel): string {
  if (nota.textoCloze === null || nota.textoCloze.trim() === '') {
    throw new CardifyError('nota_cloze_sem_texto', `nota ${nota.id} é cloze sem textoCloze`);
  }
  return nota.textoCloze;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?|\n/g, '<br>');
}

function campo(valor: string, separador: ',' | '\t'): string {
  const precisaAspas = valor.includes(separador) || valor.includes('"') || /^\s|\s$/.test(valor);
  return precisaAspas ? `"${valor.replace(/"/g, '""')}"` : valor;
}
