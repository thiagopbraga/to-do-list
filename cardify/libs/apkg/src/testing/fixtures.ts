import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NotaExportavel, PacoteBaralho } from '@cardify/shared';

export const NOMES_FIXTURES = ['aula-medicina', 'lei-seca', 'slides'] as const;
export type NomeFixture = (typeof NOMES_FIXTURES)[number];

/** Raiz do pacote `cardify/` (este arquivo fica em libs/apkg/src/testing). */
export const RAIZ_CARDIFY = path.resolve(__dirname, '../../../..');

/** `atualizadoEm` de todas as notas geradas, salvo quando um teste edita uma. */
export const ATUALIZADO_EM_BASE = new Date('2026-05-01T12:00:00.000Z');
export const ATUALIZADO_EM_POSTERIOR = new Date('2026-05-02T09:30:00.000Z');
/** Relógios de exportação distintos: o `mod` das notas não pode depender deles. */
export const RELOGIO_EXPORTACAO_1 = () => new Date('2026-06-01T10:00:00.000Z');
export const RELOGIO_EXPORTACAO_2 = () => new Date('2026-06-15T18:45:00.000Z');

interface LinhaEsperada {
  texto: string;
  ruido: boolean;
}
interface TituloEsperado {
  texto: string;
  nivel: number;
}
interface FixtureEsperado {
  linhas: LinhaEsperada[];
  titulos: TituloEsperado[];
}

const MIN_CARACTERES_CORPO = 40;
const PALAVRA = /[\p{L}\p{N}]+/gu;

export function slugDoFixture(nome: NomeFixture): string {
  return `fixture-${nome}`;
}

/** UUID v4-like determinístico: sha1(sha1 do fixture + índice) formatado com versão 4 e variante RFC 4122. */
export function uuidDeterministico(sha1Fixture: string, indice: number): string {
  const hex = createHash('sha1').update(`${sha1Fixture}:${indice}`).digest('hex');
  const variante = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variante}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Oculta a palavra mais longa com c1 e, em clozes múltiplos de 3, a segunda mais longa com c2. */
export function ocluirPalavras(linha: string, duasOclusoes: boolean): string {
  const palavras = [...linha.matchAll(PALAVRA)].map((m) => ({ texto: m[0], inicio: m.index }));
  const porTamanho = [...palavras].sort((a, b) => b.texto.length - a.texto.length || a.inicio - b.inicio);
  const escolhidas = porTamanho.slice(0, duasOclusoes ? 2 : 1).map((palavra, i) => ({ ...palavra, indice: i + 1 }));
  let saida = linha;
  for (const { texto, inicio, indice } of [...escolhidas].sort((a, b) => b.inicio - a.inicio)) {
    saida = `${saida.slice(0, inicio)}{{c${indice}::${texto}}}${saida.slice(inicio + texto.length)}`;
  }
  return saida;
}

function metade(linha: string): [string, string] {
  const palavras = linha.split(/\s+/);
  const corte = Math.ceil(palavras.length / 2);
  return [palavras.slice(0, corte).join(' '), palavras.slice(corte).join(' ')];
}

/**
 * Notas determinísticas (sem LLM) a partir das linhas de corpo do `.esperado.json`: títulos viram a trilha,
 * linhas longas viram alternadamente nota básica e cloze. No fim entram notas com `&`, `<`, aspas e quebra de linha.
 */
export function montarNotasDoFixture(nome: NomeFixture): NotaExportavel[] {
  const bruto = readFileSync(path.join(RAIZ_CARDIFY, 'fixtures/pdf', `${nome}.esperado.json`));
  const sha1Fixture = createHash('sha1').update(bruto).digest('hex');
  const esperado = JSON.parse(bruto.toString('utf8')) as FixtureEsperado;
  const niveisPorTitulo = new Map(esperado.titulos.map((t) => [t.texto, t.nivel]));

  const notas: NotaExportavel[] = [];
  let trilha: string[] = [];
  let basicas = 0;
  let clozes = 0;
  const acrescentar = (parcial: Pick<NotaExportavel, 'tipo' | 'frente' | 'verso' | 'textoCloze'>): void => {
    notas.push({
      id: uuidDeterministico(sha1Fixture, notas.length),
      ...parcial,
      trilhaTitulos: [...trilha],
      tags: [],
      ordem: notas.length,
      atualizadoEm: ATUALIZADO_EM_BASE,
    });
  };

  for (const linha of esperado.linhas) {
    if (linha.ruido) continue;
    const nivel = niveisPorTitulo.get(linha.texto);
    if (nivel !== undefined) {
      trilha = [...trilha.slice(0, nivel - 1), linha.texto];
      continue;
    }
    if (linha.texto.length < MIN_CARACTERES_CORPO) continue;
    if (notas.length % 2 === 0) {
      const [inicio, fim] = metade(linha.texto);
      acrescentar({ tipo: 'basico', frente: `Complete: ${inicio}`, verso: fim, textoCloze: null });
      basicas += 1;
    } else {
      clozes += 1;
      acrescentar({ tipo: 'cloze', frente: '', verso: '', textoCloze: ocluirPalavras(linha.texto, clozes % 3 === 0) });
    }
  }

  acrescentar({
    tipo: 'basico',
    frente: 'Quanto vale "P & V" se P < 120 mmHg?',
    verso: 'Linha 1: a razão P&V < 1\nLinha 2: "aspas" e <b>não é tag</b>',
    textoCloze: null,
  });
  acrescentar({
    tipo: 'cloze',
    frente: '',
    verso: '',
    textoCloze: 'Se P < 120 & V > 5 então {{c1::"normal" & estável}}\nSegunda linha: {{c2::R&D <ok>}}',
  });
  acrescentar({ tipo: 'basico', frente: 'Pergunta com\r\nCRLF e tab\taqui', verso: "Resposta com 'apóstrofo' e emoji 💓", textoCloze: null });

  if (basicas === 0 || clozes === 0) throw new Error(`fixture ${nome} não gerou notas dos dois tipos`);
  return notas;
}

export function montarPacoteDoFixture(nome: NomeFixture, notas: NotaExportavel[] = montarNotasDoFixture(nome)): PacoteBaralho {
  return { nomeBaralho: `Fixture ${nome}`, slugDocumento: slugDoFixture(nome), notas };
}
