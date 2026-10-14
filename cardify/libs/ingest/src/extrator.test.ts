import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DocumentoInvalidoError } from '@cardify/shared';
import { PdfJsExtractor } from './extrator';

interface LinhaEsperada {
  pagina: number;
  texto: string;
  fonteTamanho: number;
  negrito: boolean;
  ruido: boolean;
}
interface Esperado {
  paginas: number;
  escaneado: boolean;
  linhas: LinhaEsperada[];
}

const DIR = resolve(__dirname, '..', '..', '..', 'fixtures', 'pdf');
const lerPdf = (nome: string) => new Uint8Array(readFileSync(resolve(DIR, `${nome}.pdf`)));
const lerEsperado = (nome: string) => JSON.parse(readFileSync(resolve(DIR, `${nome}.esperado.json`), 'utf8')) as Esperado;

const extrator = new PdfJsExtractor();

describe('PdfJsExtractor', () => {
  describe.each(['aula-medicina', 'lei-seca', 'slides', 'denso-40-paginas', 'escaneado'])('fixture %s', (nome) => {
    it('reproduz páginas, texto das linhas, fonte e negrito do esperado', async () => {
      const esperado = lerEsperado(nome);
      const inicio = performance.now();
      const doc = await extrator.extrair(lerPdf(nome));
      const ms = Math.round(performance.now() - inicio);
      if (nome === 'denso-40-paginas') {
        console.log(`denso-40-paginas: ${doc.paginas.length} páginas extraídas em ${ms} ms`);
        expect(ms).toBeLessThan(10_000);
      }

      expect(doc.paginas).toHaveLength(esperado.paginas);
      expect(doc.escaneado).toBe(esperado.escaneado);

      for (const pagina of doc.paginas) {
        const esperadas = esperado.linhas.filter((l) => l.pagina === pagina.numero);
        expect(pagina.linhas.map((l) => l.texto), `textos da página ${pagina.numero}`).toEqual(esperadas.map((l) => l.texto));
        pagina.linhas.forEach((linha, i) => {
          const alvo = esperadas[i]!;
          expect(Math.abs(linha.fonteTamanho - alvo.fonteTamanho), `fonte de "${alvo.texto}"`).toBeLessThanOrEqual(0.5);
          expect(linha.negrito, `negrito de "${alvo.texto}"`).toBe(alvo.negrito);
          expect(linha.yNorm).toBeGreaterThanOrEqual(0);
          expect(linha.yNorm).toBeLessThanOrEqual(1);
          expect(linha.xNorm).toBeGreaterThanOrEqual(0);
          expect(linha.xNorm).toBeLessThanOrEqual(1);
        });
      }

      const total = doc.paginas.reduce((s, p) => s + p.linhas.reduce((t, l) => t + l.texto.length, 0), 0);
      expect(doc.totalCaracteres).toBe(total);
    });

    it('posiciona cabeçalhos em yNorm < 0.08 e rodapés em yNorm > 0.92', async () => {
      const ruidosas = lerEsperado(nome).linhas.filter((l) => l.ruido);
      if (ruidosas.length === 0) return;
      const doc = await extrator.extrair(lerPdf(nome));
      for (const alvo of ruidosas) {
        const linha = doc.paginas[alvo.pagina - 1]!.linhas.find((l) => l.texto === alvo.texto);
        expect(linha, `linha de ruído "${alvo.texto}"`).toBeDefined();
        const nasBordas = linha!.yNorm < 0.08 || linha!.yNorm > 0.92;
        expect(nasBordas, `"${alvo.texto}" com yNorm ${linha!.yNorm}`).toBe(true);
      }
      expect(doc.paginas[0]!.linhas[0]!.yNorm).toBeLessThan(0.08);
    });
  });

  it('lança DocumentoInvalidoError(corrompido) para PDF corrompido', async () => {
    const erro = await extrator.extrair(lerPdf('corrompido')).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(DocumentoInvalidoError);
    expect((erro as DocumentoInvalidoError).motivo).toBe('corrompido');
  });

  it('lança DocumentoInvalidoError(paginas_demais) antes de processar quando excede maxPaginas', async () => {
    const erro = await extrator.extrair(lerPdf('aula-medicina'), { maxPaginas: 3 }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(DocumentoInvalidoError);
    expect((erro as DocumentoInvalidoError).motivo).toBe('paginas_demais');
  });

  it('aceita documento com exatamente maxPaginas páginas', async () => {
    const doc = await extrator.extrair(lerPdf('aula-medicina'), { maxPaginas: 6 });
    expect(doc.paginas).toHaveLength(6);
  });

  it('não consome o buffer do chamador', async () => {
    const dados = lerPdf('slides');
    const tamanho = dados.byteLength;
    await extrator.extrair(dados);
    expect(dados.byteLength).toBe(tamanho);
    await extrator.extrair(dados);
  });
});
