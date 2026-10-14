import type { PDFDocument, PDFFont } from 'pdf-lib';
import { rgb } from 'pdf-lib';

/** Uma sequência de `drawText` na mesma linha; `dx` é o deslocamento horizontal desde o início da linha. */
export interface Peca {
  texto: string;
  dx: number;
}

export interface LinhaDesenhada {
  x: number;
  /** Baseline em coordenadas PDF (origem embaixo). */
  y: number;
  tamanho: number;
  negrito: boolean;
  ruido: boolean;
  cinza: number;
  /** Texto exatamente como o agrupador deve reconstruir. */
  texto: string;
  pecas: Peca[];
  nivel: number | null;
}

export interface PaginaDesenhada {
  largura: number;
  altura: number;
  linhas: LinhaDesenhada[];
}

export interface Fontes {
  regular: PDFFont;
  negrito: PDFFont;
}

export interface ConfigPagina {
  largura: number;
  altura: number;
  margemEsq: number;
  margemDir: number;
  /** Distância do topo até a primeira linha de conteúdo. */
  topo: number;
  /** Distância da base até a última linha de conteúdo. */
  base: number;
}

export interface OpcoesLinha {
  tamanho: number;
  negrito?: boolean;
  entrelinha: number;
  recuo?: number;
  nivel?: number;
  marcador?: string;
  /** Força (true/false) o desenho palavra por palavra; padrão: decide `palavrasSoltas` ou a presença de `|`. */
  soltas?: boolean;
}

export interface OpcoesParagrafo extends Omit<OpcoesLinha, 'nivel'> {
  depois?: number;
}

export interface OpcoesRuido {
  tamanho: number;
  y: number;
  alinhamento: 'esq' | 'centro' | 'dir';
  cinza: number;
  negrito?: boolean;
}

export const A4 = { largura: 595.28, altura: 841.89 };

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class Compositor {
  readonly paginas: PaginaDesenhada[] = [];
  private y = 0;
  private quebraPendente = false;
  private contadorLinhasCorpo = 0;

  constructor(
    private readonly cfg: ConfigPagina,
    private readonly fontes: Fontes,
    private readonly palavrasSoltas: (indiceLinhaCorpo: number) => boolean = () => false,
  ) {
    this.abrirPagina();
  }

  quebra(): void {
    this.quebraPendente = true;
  }

  espaco(pontos: number): void {
    this.y -= pontos;
  }

  titulo(nivel: number, texto: string, op: { tamanho: number; entrelinha: number; antes: number; depois: number }): void {
    const linhas = this.quebrarEmLinhas(texto.split(' '), op.tamanho, true, this.larguraUtil(0));
    if (linhas.length !== 1) throw new Error(`título não cabe em uma linha: ${texto}`);
    this.reservar(op.antes + op.entrelinha + op.depois + 2 * 15);
    if (this.paginas[this.paginas.length - 1].linhas.length > 0) this.y -= op.antes;
    this.colocarLinha(linhas[0], { tamanho: op.tamanho, negrito: true, entrelinha: op.entrelinha, nivel, soltas: false });
    this.y -= op.depois;
  }

  paragrafo(texto: string, op: OpcoesParagrafo): void {
    const recuo = op.recuo ?? 0;
    const negrito = op.negrito ?? false;
    const linhas = this.quebrarEmLinhas(texto.split(' ').filter(Boolean), op.tamanho, negrito, this.larguraUtil(recuo));
    for (const tokens of linhas) this.colocarLinha(tokens, op);
    this.y -= op.depois ?? 0;
  }

  /** Cabeçalho, rodapé e marca d'água: chamados depois que o total de páginas é conhecido. */
  ruido(indicePagina: number, texto: string, op: OpcoesRuido): void {
    const negrito = op.negrito ?? false;
    const largura = this.largura(texto, op.tamanho, negrito);
    const util = this.cfg.largura - this.cfg.margemEsq - this.cfg.margemDir;
    const x =
      op.alinhamento === 'esq'
        ? this.cfg.margemEsq
        : op.alinhamento === 'dir'
          ? this.cfg.largura - this.cfg.margemDir - largura
          : this.cfg.margemEsq + (util - largura) / 2;
    this.paginas[indicePagina].linhas.push({
      x,
      y: op.y,
      tamanho: op.tamanho,
      negrito,
      ruido: true,
      cinza: op.cinza,
      texto,
      pecas: [{ texto, dx: 0 }],
      nivel: null,
    });
  }

  finalizar(): PaginaDesenhada[] {
    for (const pagina of this.paginas) pagina.linhas.sort((a, b) => b.y - a.y || a.x - b.x);
    return this.paginas;
  }

  desenhar(doc: PDFDocument): void {
    for (const pagina of this.paginas) {
      const pdfPagina = doc.addPage([pagina.largura, pagina.altura]);
      for (const linha of pagina.linhas) {
        const font = linha.negrito ? this.fontes.negrito : this.fontes.regular;
        for (const peca of linha.pecas) {
          pdfPagina.drawText(peca.texto, {
            x: linha.x + peca.dx,
            y: linha.y,
            size: linha.tamanho,
            font,
            color: rgb(linha.cinza, linha.cinza, linha.cinza),
          });
        }
      }
    }
  }

  private abrirPagina(): void {
    this.paginas.push({ largura: this.cfg.largura, altura: this.cfg.altura, linhas: [] });
    this.y = this.cfg.altura - this.cfg.topo;
  }

  private reservar(altura: number): void {
    const atual = this.paginas[this.paginas.length - 1];
    const estourou = this.y - altura < this.cfg.base;
    if ((this.quebraPendente || estourou) && atual.linhas.length > 0) this.abrirPagina();
    this.quebraPendente = false;
  }

  private larguraUtil(recuo: number): number {
    return this.cfg.largura - this.cfg.margemEsq - this.cfg.margemDir - recuo;
  }

  private largura(texto: string, tamanho: number, negrito: boolean): number {
    return (negrito ? this.fontes.negrito : this.fontes.regular).widthOfTextAtSize(texto, tamanho);
  }

  private quebrarEmLinhas(tokens: string[], tamanho: number, negrito: boolean, larguraMax: number): string[][] {
    const linhas: string[][] = [];
    let atual: string[] = [];
    for (const token of tokens) {
      const tentativa = [...atual, token].map((t) => t.replaceAll('|', '')).join(' ');
      if (atual.length > 0 && this.largura(tentativa, tamanho, negrito) > larguraMax) {
        linhas.push(atual);
        atual = [token];
      } else {
        atual.push(token);
      }
    }
    if (atual.length > 0) linhas.push(atual);
    return linhas;
  }

  private colocarLinha(tokens: string[], op: OpcoesLinha): void {
    const negrito = op.negrito ?? false;
    this.reservar(op.entrelinha);
    this.y -= op.entrelinha;

    const textoLinha = tokens.map((t) => t.replaceAll('|', '')).join(' ');
    const temDivisao = tokens.some((t) => t.includes('|'));
    const soltas = op.soltas ?? (temDivisao || this.palavrasSoltas(this.contadorLinhasCorpo++));
    const espaco = this.largura(' ', op.tamanho, negrito);

    const pecas: Peca[] = [];
    if (soltas) {
      let dx = 0;
      for (const token of tokens) {
        for (const parte of token.split('|')) {
          pecas.push({ texto: parte, dx });
          dx += this.largura(parte, op.tamanho, negrito);
        }
        dx += espaco;
      }
    } else {
      pecas.push({ texto: textoLinha, dx: 0 });
    }

    let texto = textoLinha;
    if (op.marcador) {
      const deslocamento = this.largura(op.marcador, op.tamanho, negrito) + 1.5 * espaco;
      for (const peca of pecas) peca.dx += deslocamento;
      pecas.unshift({ texto: op.marcador, dx: 0 });
      texto = `${op.marcador} ${textoLinha}`;
    }

    this.paginas[this.paginas.length - 1].linhas.push({
      x: this.cfg.margemEsq + (op.recuo ?? 0),
      y: this.y,
      tamanho: op.tamanho,
      negrito,
      ruido: false,
      cinza: 0,
      texto,
      pecas,
      nivel: op.nivel ?? null,
    });
  }
}
