import type { LinhaPdf } from '@cardify/shared';

/** Fragmento de texto do pdfjs já reduzido da matriz de transformação. `y` é a linha de base, origem no canto inferior esquerdo. */
export interface ItemTexto {
  str: string;
  x: number;
  y: number;
  fonteTamanho: number;
  largura: number;
  negrito: boolean;
}

const FRACAO_ALTURA_MESMA_LINHA = 0.5;
const FRACAO_GLIFO_PARA_ESPACO = 0.25;

const limitar01 = (valor: number): number => Math.min(1, Math.max(0, valor));
const arredondar1 = (valor: number): number => Math.round(valor * 10) / 10;
const ehEspaco = (str: string): boolean => str.trim() === '';

function agruparPorBaseline(itens: ItemTexto[]): ItemTexto[][] {
  const ordenados = itens.filter((item) => item.str !== '').sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: ItemTexto[][] = [];
  for (const item of ordenados) {
    const grupo = grupos[grupos.length - 1];
    const referencia = grupo?.[0];
    if (referencia && Math.abs(referencia.y - item.y) < FRACAO_ALTURA_MESMA_LINHA * Math.max(referencia.fonteTamanho, item.fonteTamanho)) {
      grupo.push(item);
    } else {
      grupos.push([item]);
    }
  }
  return grupos;
}

function montarTexto(grupo: ItemTexto[]): string {
  let texto = '';
  let anterior: ItemTexto | undefined;
  let espacoPendente = false;
  for (const item of grupo) {
    if (ehEspaco(item.str)) {
      espacoPendente = true;
      continue;
    }
    if (anterior) {
      const gap = item.x - (anterior.x + anterior.largura);
      const larguraMediaGlifo = anterior.largura / Math.max(anterior.str.length, 1);
      if (espacoPendente || gap > FRACAO_GLIFO_PARA_ESPACO * larguraMediaGlifo) texto += ' ';
    }
    texto += item.str;
    anterior = item;
    espacoPendente = false;
  }
  return texto.replace(/\s+/g, ' ').trim();
}

function montarLinha(grupo: ItemTexto[], alturaPagina: number, larguraPagina: number): LinhaPdf | null {
  grupo.sort((a, b) => a.x - b.x);
  const texto = montarTexto(grupo);
  const visiveis = grupo.filter((item) => !ehEspaco(item.str));
  const primeiro = visiveis[0];
  if (texto === '' || !primeiro) return null;

  let dominante = primeiro;
  let caracteres = 0;
  let caracteresNegrito = 0;
  let topo = -Infinity;
  for (const item of visiveis) {
    const n = item.str.trim().length;
    if (n > dominante.str.trim().length) dominante = item;
    caracteres += n;
    if (item.negrito) caracteresNegrito += n;
    topo = Math.max(topo, item.y + item.fonteTamanho);
  }

  return {
    texto,
    fonteTamanho: arredondar1(dominante.fonteTamanho),
    negrito: caracteresNegrito * 2 > caracteres,
    yNorm: limitar01(1 - topo / alturaPagina),
    xNorm: limitar01(primeiro.x / larguraPagina),
  };
}

/** Reconstrói linhas de leitura a partir dos fragmentos soltos do pdfjs (RFC §3.2). */
export function agruparLinhas(itens: ItemTexto[], alturaPagina: number, larguraPagina: number): LinhaPdf[] {
  const linhas: LinhaPdf[] = [];
  for (const grupo of agruparPorBaseline(itens)) {
    const linha = montarLinha(grupo, alturaPagina, larguraPagina);
    if (linha) linhas.push(linha);
  }
  return linhas;
}
