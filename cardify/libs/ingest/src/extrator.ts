import {
  DocumentoInvalidoError,
  LIMITES_DOCUMENTO,
  type DocumentoExtraido,
  type OpcoesExtracao,
  type PaginaPdf,
  type PdfExtractor,
} from '@cardify/shared';
import { agruparLinhas, type ItemTexto } from './agrupamento';

interface ItemPdfjs {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
}

interface PaginaPdfjs {
  view: number[];
  commonObjs: { get(id: string): { name?: string; bold?: boolean; black?: boolean } | undefined };
  getViewport(opcoes: { scale: number; rotation?: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: (ItemPdfjs | { type: string })[] }>;
  getOperatorList(): Promise<unknown>;
  cleanup(): boolean;
}

interface DocumentoPdfjs {
  numPages: number;
  getPage(numero: number): Promise<PaginaPdfjs>;
  destroy(): Promise<void>;
}

interface Pdfjs {
  getDocument(opcoes: Record<string, unknown>): { promise: Promise<DocumentoPdfjs> };
}

const PADRAO_NEGRITO = /bold|black|heavy/i;

const ehItemTexto = (item: ItemPdfjs | { type: string }): item is ItemPdfjs => 'str' in item;

/**
 * O fontName do item (`g_d0_f1`) é um id interno; o nome real (`Helvetica-Bold`) só existe em
 * `page.commonObjs` depois que o operator list da página foi lido. `textContent.styles` só traz `sans-serif`.
 */
function detectarFontesNegrito(pagina: PaginaPdfjs, nomes: Iterable<string>): Map<string, boolean> {
  const negrito = new Map<string, boolean>();
  for (const nome of nomes) {
    let ehNegrito = PADRAO_NEGRITO.test(nome);
    try {
      const fonte = pagina.commonObjs.get(nome);
      ehNegrito = PADRAO_NEGRITO.test(fonte?.name ?? '') || fonte?.bold === true || fonte?.black === true || ehNegrito;
    } catch {
      // fonte não resolvida: fica só o sinal do id
    }
    negrito.set(nome, ehNegrito);
  }
  return negrito;
}

async function extrairPagina(doc: DocumentoPdfjs, numero: number): Promise<PaginaPdf> {
  const pagina = await doc.getPage(numero);
  try {
    const itens = (await pagina.getTextContent()).items.filter(ehItemTexto);
    await pagina.getOperatorList();
    const negritoPorFonte = detectarFontesNegrito(pagina, new Set(itens.map((item) => item.fontName)));

    // Rotação 0: a matriz do texto está no espaço não rotacionado da página.
    const natural = pagina.getViewport({ scale: 1, rotation: 0 });
    const exibida = pagina.getViewport({ scale: 1 });
    const origemY = pagina.view[1] ?? 0;

    const itensTexto: ItemTexto[] = itens.map((item) => ({
      str: item.str,
      x: item.transform[4] ?? 0,
      y: (item.transform[5] ?? 0) - origemY,
      fonteTamanho: Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 0),
      largura: item.width,
      negrito: negritoPorFonte.get(item.fontName) ?? false,
    }));

    return {
      numero,
      largura: exibida.width,
      altura: exibida.height,
      linhas: agruparLinhas(itensTexto, natural.height, natural.width),
    };
  } finally {
    pagina.cleanup();
  }
}

export class PdfJsExtractor implements PdfExtractor {
  async extrair(dados: Uint8Array, opcoes: OpcoesExtracao = {}): Promise<DocumentoExtraido> {
    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as Pdfjs;

    let doc: DocumentoPdfjs;
    try {
      // O pdfjs transfere o buffer recebido; a cópia preserva o do chamador.
      doc = await pdfjs.getDocument({
        data: new Uint8Array(dados),
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false,
        verbosity: 0,
      }).promise;
    } catch (erro) {
      throw new DocumentoInvalidoError('corrompido', `PDF ilegível: ${erro instanceof Error ? erro.message : String(erro)}`);
    }

    try {
      if (opcoes.maxPaginas !== undefined && doc.numPages > opcoes.maxPaginas) {
        throw new DocumentoInvalidoError('paginas_demais', `documento com ${doc.numPages} páginas; máximo ${opcoes.maxPaginas}`);
      }

      const paginas: PaginaPdf[] = [];
      for (let numero = 1; numero <= doc.numPages; numero++) {
        paginas.push(await extrairPagina(doc, numero));
      }

      const totalCaracteres = paginas.reduce(
        (soma, pagina) => soma + pagina.linhas.reduce((s, linha) => s + linha.texto.length, 0),
        0,
      );
      return {
        paginas,
        totalCaracteres,
        escaneado: totalCaracteres / Math.max(paginas.length, 1) < LIMITES_DOCUMENTO.minCaracteresPorPagina,
      };
    } catch (erro) {
      if (erro instanceof DocumentoInvalidoError) throw erro;
      throw new DocumentoInvalidoError('corrompido', `falha ao ler o PDF: ${erro instanceof Error ? erro.message : String(erro)}`);
    } finally {
      await doc.destroy();
    }
  }
}
