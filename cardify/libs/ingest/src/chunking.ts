import { createRequire } from 'node:module';
import type { Tiktoken } from 'js-tiktoken' with { 'resolution-mode': 'import' };
import { CHUNKING, type ChunkDocumento, type DocumentoExtraido, type LinhaPdf } from '@cardify/shared';

const NIVEIS_MAXIMOS = 3;
const SALTO_MINIMO_TITULO_PT = 1;
const MAX_CARACTERES_TITULO = 150;

let encoder: Tiktoken | null = null;

function criarEncoder(): Tiktoken {
  // Os tipos do js-tiktoken são ESM-only sob module Node16; o runtime CJS (dist/index.cjs) funciona normalmente.
  const { getEncoding } = createRequire(__filename)('js-tiktoken') as typeof import('js-tiktoken', { with: { 'resolution-mode': 'import' } });
  return getEncoding('cl100k_base');
}

/** cl100k_base é uma aproximação: o Claude usa outro tokenizer, então a contagem serve como estimativa de tamanho. */
export function contarTokens(texto: string): number {
  encoder ??= criarEncoder();
  // disallowedSpecial = []: trechos como "<|endoftext|>" no documento são texto comum, não erro.
  return encoder.encode(texto, [], []).length;
}

export interface TituloDetectado {
  texto: string;
  nivel: number;
}

type ElementoLinha = { tipo: 'titulo'; nivel: number; texto: string } | { tipo: 'corpo'; texto: string };

interface Bloco {
  trilha: string[];
  linhas: string[];
}

interface Rascunho {
  trilhaTitulos: string[];
  texto: string;
  tokens: number;
}

interface Unidade {
  texto: string;
  tokens: number;
  /** Separador entre esta unidade e a anterior dentro do mesmo chunk. */
  separador: string;
}

function arredondarMeioPonto(valor: number): number {
  return Math.round(valor * 2) / 2;
}

function normalizarLinha(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

function tamanhoModal(linhas: LinhaPdf[]): number {
  const pesos = new Map<number, number>();
  for (const linha of linhas) {
    const tamanho = arredondarMeioPonto(linha.fonteTamanho);
    pesos.set(tamanho, (pesos.get(tamanho) ?? 0) + linha.texto.length);
  }
  let modal = 0;
  let melhorPeso = -1;
  for (const [tamanho, peso] of pesos) {
    if (peso > melhorPeso || (peso === melhorPeso && tamanho < modal)) {
      modal = tamanho;
      melhorPeso = peso;
    }
  }
  return modal;
}

const TERMINADOR = /[.:;?!]$/;
const INICIO_NOVO_PARAGRAFO = /^(?:[\p{Lu}•\-–\d§]|Art\.)/u;

function semMinusculas(linha: string): boolean {
  return /\p{Lu}/u.test(linha) && !/\p{Ll}/u.test(linha);
}

function iniciaParagrafo(anterior: string, atual: string): boolean {
  if (atual.startsWith('•')) return true;
  if (TERMINADOR.test(anterior) && INICIO_NOVO_PARAGRAFO.test(atual)) return true;
  // Título em caixa alta sem fonte maior (ex.: "TÍTULO I – ...") não deve colar no parágrafo seguinte.
  return semMinusculas(anterior);
}

function juntarLinhas(anterior: string, atual: string): string {
  if (/\p{L}-$/u.test(anterior) && /^\p{Ll}/u.test(atual)) return anterior.slice(0, -1) + atual;
  return `${anterior} ${atual}`;
}

function montarParagrafos(linhas: string[]): string[] {
  const paragrafos: string[] = [];
  let anterior = '';
  for (const linha of linhas) {
    if (paragrafos.length === 0 || iniciaParagrafo(anterior, linha)) {
      paragrafos.push(linha);
    } else {
      paragrafos[paragrafos.length - 1] = juntarLinhas(paragrafos[paragrafos.length - 1], linha);
    }
    anterior = linha;
  }
  return paragrafos;
}

const ABREVIACOES = 'Art|Arts|Dr|Dra|Prof|Profa|Sr|Sra|Fig|Cap|Inc|Nº|nº|pág|Pág|etc|ex|vs|aprox';
const DIVISOR_FRASES = new RegExp(`(?<!\\b(?:${ABREVIACOES})\\.)(?<=[.!?…])\\s+(?=[\\p{Lu}\\d"“(•§])`, 'u');

function dividirFrases(texto: string): string[] {
  return texto
    .split(DIVISOR_FRASES)
    .map((frase) => frase.trim())
    .filter(Boolean);
}

/** Divide ao meio em fronteira de palavra, recursivamente, até caber no limite. */
function dividirAoMeio(texto: string, limite: number): string[] {
  if (contarTokens(texto) <= limite) return [texto];
  const palavras = texto.split(/\s+/);
  if (palavras.length < 2) {
    const meio = Math.ceil(texto.length / 2);
    return [...dividirAoMeio(texto.slice(0, meio), limite), ...dividirAoMeio(texto.slice(meio), limite)];
  }
  const meio = Math.ceil(palavras.length / 2);
  return [
    ...dividirAoMeio(palavras.slice(0, meio).join(' '), limite),
    ...dividirAoMeio(palavras.slice(meio).join(' '), limite),
  ];
}

function expandirEmUnidades(paragrafos: string[], limite: number): Unidade[] {
  const unidades: Unidade[] = [];
  for (const paragrafo of paragrafos) {
    const tokens = contarTokens(paragrafo);
    if (tokens <= limite) {
      unidades.push({ texto: paragrafo, tokens, separador: '\n\n' });
      continue;
    }
    const pedacos = dividirFrases(paragrafo).flatMap((frase) => dividirAoMeio(frase, limite));
    pedacos.forEach((pedaco, indice) => {
      unidades.push({ texto: pedaco, tokens: contarTokens(pedaco), separador: indice === 0 ? '\n\n' : ' ' });
    });
  }
  return unidades;
}

function unirUnidades(unidades: Unidade[]): string {
  return unidades.reduce((texto, unidade, indice) => (indice === 0 ? unidade.texto : texto + unidade.separador + unidade.texto), '');
}

/** Últimas unidades (inteiras ou, para parágrafos longos, só as últimas frases) que somam até `limite` tokens. */
function cauda(unidades: Unidade[], limite: number): Unidade[] {
  const resultado: Unidade[] = [];
  let restante = limite;
  for (let i = unidades.length - 1; i >= 0 && restante > 0; i--) {
    const unidade = unidades[i];
    if (unidade.tokens + 1 <= restante) {
      resultado.unshift(unidade);
      restante -= unidade.tokens + 1;
      continue;
    }
    const frases = dividirFrases(unidade.texto);
    const parciais: Unidade[] = [];
    for (let j = frases.length - 1; j >= 0; j--) {
      const tokens = contarTokens(frases[j]);
      if (tokens + 1 > restante) break;
      parciais.unshift({ texto: frases[j], tokens, separador: ' ' });
      restante -= tokens + 1;
    }
    resultado.unshift(...parciais);
    break;
  }
  return resultado;
}

function agruparParagrafos(paragrafos: string[]): string[] {
  const { maxTokens, sobreposicaoTokens } = CHUNKING;
  const unidades = expandirEmUnidades(paragrafos, maxTokens - 1);
  const textos: string[] = [];
  let atual: Unidade[] = [];
  let tokensAtuais = 0;
  let novas = 0;

  const custo = (unidade: Unidade): number => unidade.tokens + 1;

  for (const unidade of unidades) {
    if (atual.length > 0 && tokensAtuais + custo(unidade) > maxTokens) {
      textos.push(unirUnidades(atual));
      let sobreposicao = cauda(atual, sobreposicaoTokens);
      let tokensSobreposicao = sobreposicao.reduce((soma, item) => soma + custo(item), 0);
      if (tokensSobreposicao + custo(unidade) > maxTokens) {
        sobreposicao = [];
        tokensSobreposicao = 0;
      }
      atual = sobreposicao;
      tokensAtuais = tokensSobreposicao;
      novas = 0;
    }
    atual.push(unidade);
    tokensAtuais += custo(unidade);
    novas++;
  }
  if (atual.length > 0 && (novas > 0 || textos.length === 0)) textos.push(unirUnidades(atual));
  return textos;
}

function blocoParaRascunhos(bloco: Bloco, paragrafos: string[]): Rascunho[] {
  return agruparParagrafos(paragrafos).map((texto) => ({
    trilhaTitulos: bloco.trilha,
    texto,
    tokens: contarTokens(texto),
  }));
}

function mesmoCapitulo(a: Rascunho, b: Rascunho): boolean {
  return a.trilhaTitulos[0] === b.trilhaTitulos[0];
}

function fundir(a: Rascunho, b: Rascunho): Rascunho {
  const texto = `${a.texto}\n\n${b.texto}`;
  return { trilhaTitulos: a.trilhaTitulos, texto, tokens: contarTokens(texto) };
}

function fundirPequenos(rascunhos: Rascunho[]): Rascunho[] {
  const { minTokens, maxTokens } = CHUNKING;
  const saida: Rascunho[] = [];
  let i = 0;
  while (i < rascunhos.length) {
    let atual = rascunhos[i++];
    while (atual.tokens < minTokens && i < rascunhos.length && mesmoCapitulo(atual, rascunhos[i])) {
      const fundido = fundir(atual, rascunhos[i]);
      if (fundido.tokens > maxTokens) break;
      atual = fundido;
      i++;
    }
    const anterior = saida[saida.length - 1];
    if (atual.tokens < minTokens && anterior && mesmoCapitulo(anterior, atual)) {
      const fundido = fundir(anterior, atual);
      if (fundido.tokens <= maxTokens) {
        saida[saida.length - 1] = fundido;
        continue;
      }
    }
    saida.push(atual);
  }
  return saida;
}

function finalizar(rascunhos: Rascunho[]): ChunkDocumento[] {
  return fundirPequenos(rascunhos).map((rascunho, ordem) => ({
    ordem,
    trilhaTitulos: rascunho.trilhaTitulos,
    texto: rascunho.texto,
    tokens: rascunho.tokens,
  }));
}

function classificarLinhas(doc: DocumentoExtraido): ElementoLinha[] {
  const linhas = doc.paginas
    .flatMap((pagina) => pagina.linhas)
    .map((linha) => ({ ...linha, texto: normalizarLinha(linha.texto) }))
    .filter((linha) => linha.texto.length > 0);
  if (linhas.length === 0) return [];

  const modal = tamanhoModal(linhas);
  const ehTitulo = (linha: LinhaPdf): boolean =>
    arredondarMeioPonto(linha.fonteTamanho) >= modal + SALTO_MINIMO_TITULO_PT && linha.texto.length <= MAX_CARACTERES_TITULO;

  const tamanhosTitulo = [...new Set(linhas.filter(ehTitulo).map((l) => arredondarMeioPonto(l.fonteTamanho)))].sort(
    (a, b) => b - a,
  );
  const nivelDe = (linha: LinhaPdf): number =>
    Math.min(tamanhosTitulo.indexOf(arredondarMeioPonto(linha.fonteTamanho)) + 1, NIVEIS_MAXIMOS);

  const elementos: ElementoLinha[] = [];
  let tamanhoTituloAnterior: number | null = null;
  for (const linha of linhas) {
    if (!ehTitulo(linha)) {
      elementos.push({ tipo: 'corpo', texto: linha.texto });
      tamanhoTituloAnterior = null;
      continue;
    }
    const tamanho = arredondarMeioPonto(linha.fonteTamanho);
    const ultimo = elementos[elementos.length - 1];
    if (ultimo?.tipo === 'titulo' && tamanhoTituloAnterior === tamanho) {
      ultimo.texto = juntarLinhas(ultimo.texto, linha.texto);
    } else {
      elementos.push({ tipo: 'titulo', nivel: nivelDe(linha), texto: linha.texto });
    }
    tamanhoTituloAnterior = tamanho;
  }
  return elementos;
}

function titulosDe(elementos: ElementoLinha[]): TituloDetectado[] {
  return elementos.flatMap((e) => (e.tipo === 'titulo' ? [{ texto: e.texto, nivel: e.nivel }] : []));
}

/** Títulos inferidos da distribuição de tamanhos de fonte (RFC §3.4, passos 1 e 2). */
export function detectarTitulos(doc: DocumentoExtraido): TituloDetectado[] {
  return titulosDe(classificarLinhas(doc));
}

function agruparEmBlocos(elementos: ElementoLinha[]): Bloco[] {
  const blocos: Bloco[] = [];
  const pilha: (string | undefined)[] = [];
  let atual: Bloco = { trilha: [], linhas: [] };
  for (const elemento of elementos) {
    if (elemento.tipo === 'corpo') {
      atual.linhas.push(elemento.texto);
      continue;
    }
    if (atual.linhas.length > 0) blocos.push(atual);
    pilha.length = elemento.nivel;
    pilha[elemento.nivel - 1] = elemento.texto;
    atual = { trilha: pilha.filter((t): t is string => t !== undefined), linhas: [] };
  }
  if (atual.linhas.length > 0) blocos.push(atual);
  return blocos;
}

/** T06 — chunking semântico por títulos inferidos do tamanho de fonte (RFC §3.4). */
export function chunkDocumento(doc: DocumentoExtraido): ChunkDocumento[] {
  const elementos = classificarLinhas(doc);
  if (titulosDe(elementos).length < 2) {
    const linhas = elementos.map((e) => e.texto);
    return finalizar(blocoParaRascunhos({ trilha: [], linhas }, montarParagrafos(linhas)));
  }
  const rascunhos = agruparEmBlocos(elementos).flatMap((bloco) =>
    blocoParaRascunhos(bloco, montarParagrafos(bloco.linhas)),
  );
  return finalizar(rascunhos);
}

/** T06 — fallback para texto colado / sem estrutura: quebra por parágrafo duplo. */
export function chunkTexto(texto: string): ChunkDocumento[] {
  const paragrafos = texto
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return finalizar(blocoParaRascunhos({ trilha: [], linhas: [] }, paragrafos));
}
