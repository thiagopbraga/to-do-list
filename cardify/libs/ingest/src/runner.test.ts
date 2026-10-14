import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DocumentoInvalidoError } from '@cardify/shared';
import { detectarTipo, ingerirTexto } from './runner';

const FIXTURES = resolve(__dirname, '..', '..', '..', 'fixtures');
const lerPdf = (nome: string) => readFileSync(resolve(FIXTURES, 'pdf', `${nome}.pdf`));

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('detectarTipo', () => {
  it('reconhece PDF real pelos magic bytes', async () => {
    expect(await detectarTipo(lerPdf('slides'))).toBe('pdf');
  });

  it('não reconhece PNG como PDF', async () => {
    expect(await detectarTipo(PNG_1X1)).toBe('desconhecido');
  });

  it('não confia na extensão: texto "renomeado" para .pdf é desconhecido', async () => {
    const texto = readFileSync(resolve(FIXTURES, 'texto', 'colado.txt'));
    expect(await detectarTipo(texto)).toBe('desconhecido');
  });

  it('buffer vazio é desconhecido', async () => {
    expect(await detectarTipo(new Uint8Array())).toBe('desconhecido');
  });
});

describe('ingerirTexto', () => {
  const colado = readFileSync(resolve(FIXTURES, 'texto', 'colado.txt'), 'utf8');

  it('gera chunks, sha256 e bytes do texto UTF-8', () => {
    const r = ingerirTexto(colado, 50_000);
    const limpo = colado.trim();
    expect(r.paginas).toBe(0);
    expect(r.bytes).toBe(Buffer.byteLength(limpo, 'utf8'));
    expect(r.totalCaracteres).toBe(limpo.length);
    expect(r.sha256).toBe(createHash('sha256').update(limpo, 'utf8').digest('hex'));
    expect(r.chunks.length).toBeGreaterThan(0);
    expect(r.chunks.map((c) => c.ordem)).toEqual(r.chunks.map((_, i) => i));
  });

  it('é determinístico', () => {
    expect(ingerirTexto(colado, 50_000).sha256).toBe(ingerirTexto(`\n  ${colado}  \n`, 50_000).sha256);
  });

  it.each(['', '   \n\t  '])('texto vazio (%j) lança vazio', (entrada) => {
    expect(() => ingerirTexto(entrada, 100)).toThrow(DocumentoInvalidoError);
    try {
      ingerirTexto(entrada, 100);
    } catch (erro) {
      expect((erro as DocumentoInvalidoError).motivo).toBe('vazio');
    }
  });

  it('texto acima do limite lança muito_grande', () => {
    try {
      ingerirTexto(colado, 100);
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(DocumentoInvalidoError);
      expect((erro as DocumentoInvalidoError).motivo).toBe('muito_grande');
    }
  });

  it('aceita texto exatamente no limite', () => {
    expect(() => ingerirTexto('a'.repeat(100), 100)).not.toThrow();
  });
});
