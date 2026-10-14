/**
 * Script descartável: lê os PDFs de fixtures/pdf de volta com pdfjs-dist e confere contra os `.esperado.json`.
 * Uso: npx tsx tools/fixtures/conferir.ts
 * Faz (1) checagem de contenção (texto concatenado, sem espaços, contém cada linha esperada) e
 * (2) um agrupador ingênuo de linhas (y + gap horizontal, como na RFC §3.2) comparado linha a linha.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface ItemTexto {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
}
interface PaginaPdfjs {
  getTextContent(): Promise<{ items: (ItemTexto | { type: string })[] }>;
  getOperatorList(): Promise<{ fnArray: number[] }>;
}
interface DocumentoPdfjs {
  numPages: number;
  getPage(n: number): Promise<PaginaPdfjs>;
  destroy(): Promise<void>;
}
interface Pdfjs {
  getDocument(opcoes: { data: Uint8Array; verbosity?: number }): { promise: Promise<DocumentoPdfjs> };
  OPS: { paintImageXObject: number };
}
interface Esperado {
  corrompido?: boolean;
  paginas?: number;
  escaneado?: boolean;
  linhas?: { pagina: number; texto: string; fonteTamanho: number; negrito: boolean; ruido: boolean }[];
}

const DIR_PDF = resolve(__dirname, '..', '..', 'fixtures', 'pdf');
const semEspacos = (s: string) => s.replace(/\s+/g, '');

function ehTexto(item: ItemTexto | { type: string }): item is ItemTexto {
  return 'str' in item;
}

function agrupar(itens: ItemTexto[]): { texto: string; tamanho: number }[] {
  const uteis = itens
    .filter((i) => i.str.trim() !== '')
    .map((i) => ({ ...i, x: i.transform[4], y: i.transform[5], tamanho: Math.hypot(i.transform[2], i.transform[3]) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: (typeof uteis)[] = [];
  for (const item of uteis) {
    const grupo = grupos[grupos.length - 1];
    if (grupo && Math.abs(grupo[0].y - item.y) < 0.5 * Math.max(grupo[0].tamanho, item.tamanho)) grupo.push(item);
    else grupos.push([item]);
  }
  return grupos.map((grupo) => {
    grupo.sort((a, b) => a.x - b.x);
    let texto = grupo[0].str;
    for (let i = 1; i < grupo.length; i++) {
      const anterior = grupo[i - 1];
      const gap = grupo[i].x - (anterior.x + anterior.width);
      const larguraMediaGlifo = anterior.width / Math.max(anterior.str.length, 1);
      texto += (gap > 0.25 * larguraMediaGlifo ? ' ' : '') + grupo[i].str;
    }
    return { texto: texto.replace(/\s+/g, ' ').trim(), tamanho: Math.max(...grupo.map((g) => g.tamanho)) };
  });
}

async function main(): Promise<void> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as Pdfjs;
  let falhas = 0;
  const arquivos = readdirSync(DIR_PDF).filter((f) => f.endsWith('.pdf')).sort();

  for (const arquivo of arquivos) {
    const nome = arquivo.replace(/\.pdf$/, '');
    const esperado = JSON.parse(readFileSync(join(DIR_PDF, `${nome}.esperado.json`), 'utf8')) as Esperado;
    const dados = new Uint8Array(readFileSync(join(DIR_PDF, arquivo)));

    if (esperado.corrompido) {
      try {
        const doc = await pdfjs.getDocument({ data: dados, verbosity: 0 }).promise;
        console.log(`FALHA ${nome}: pdfjs abriu o arquivo corrompido (${doc.numPages} páginas)`);
        falhas++;
      } catch (erro) {
        console.log(`ok    ${nome}: pdfjs recusou (${(erro as Error).name}: ${(erro as Error).message})`);
      }
      continue;
    }

    const doc = await pdfjs.getDocument({ data: dados, verbosity: 0 }).promise;
    let totalItens = 0;
    let totalCaracteres = 0;
    let imagens = 0;
    let linhasEsperadas = 0;
    let naoContidas = 0;
    let divergentes = 0;
    const exemplos: string[] = [];

    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const itens = (await pagina.getTextContent()).items.filter(ehTexto);
      totalItens += itens.length;
      totalCaracteres += itens.reduce((soma, i) => soma + i.str.length, 0);
      const ops = await pagina.getOperatorList();
      imagens += ops.fnArray.filter((fn) => fn === pdfjs.OPS.paintImageXObject).length;

      const esperadas = (esperado.linhas ?? []).filter((l) => l.pagina === n);
      const textoPagina = semEspacos(itens.map((i) => i.str).join(''));
      for (const linha of esperadas) {
        linhasEsperadas++;
        if (!textoPagina.includes(semEspacos(linha.texto))) {
          naoContidas++;
          if (exemplos.length < 3) exemplos.push(`pág ${n} não contida: "${linha.texto}"`);
        }
      }

      const lidas = agrupar(itens);
      const idem = lidas.length === esperadas.length && lidas.every((l, i) => l.texto === esperadas[i].texto && Math.abs(l.tamanho - esperadas[i].fonteTamanho) < 0.01);
      if (!idem) {
        divergentes++;
        if (exemplos.length < 3) {
          const i = lidas.findIndex((l, k) => !esperadas[k] || l.texto !== esperadas[k].texto);
          exemplos.push(`pág ${n} agrupamento difere na linha ${i}: lido="${lidas[i]?.texto}" esperado="${esperadas[i]?.texto}" (${lidas.length} lidas, ${esperadas.length} esperadas)`);
        }
      }
    }

    const paginasOk = doc.numPages === esperado.paginas;
    const escaneadoOk = esperado.escaneado ? totalCaracteres === 0 && imagens === doc.numPages : totalCaracteres > 0;
    const ok = paginasOk && escaneadoOk && naoContidas === 0 && divergentes === 0;
    if (!ok) falhas++;
    console.log(
      `${ok ? 'ok   ' : 'FALHA'} ${nome}: ${doc.numPages} págs (esperado ${esperado.paginas}), ${totalItens} itens, ${totalCaracteres} chars, ${imagens} imagens, ` +
        `${linhasEsperadas - naoContidas}/${linhasEsperadas} linhas contidas, ${doc.numPages - divergentes}/${doc.numPages} págs com agrupamento idêntico`,
    );
    for (const e of exemplos) console.log(`        ${e}`);
    await doc.destroy();
  }

  if (falhas > 0) {
    console.log(`\n${falhas} arquivo(s) com falha`);
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
