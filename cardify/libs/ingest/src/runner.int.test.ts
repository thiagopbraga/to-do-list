import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';
import { DocumentoInvalidoError, type MotivoDocumentoInvalido } from '@cardify/shared';
import { iniciarProcessoFilho, ingerirPdfIsolado, type LimitesIngestao } from './runner';

vi.mock('node:child_process', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:child_process')>();
  return { ...real, fork: vi.fn(real.fork) };
});

const FIXTURES = resolve(__dirname, '..', '..', '..', 'fixtures');
const lerPdf = (nome: string) => readFileSync(resolve(FIXTURES, 'pdf', `${nome}.pdf`));

const LIMITES: LimitesIngestao = { maxBytes: 50 * 1024 * 1024, maxPaginas: 300, timeoutMs: 60_000 };

async function motivoDoErro(promessa: Promise<unknown>): Promise<{ motivo: MotivoDocumentoInvalido; mensagem: string }> {
  try {
    await promessa;
  } catch (erro) {
    expect(erro).toBeInstanceOf(DocumentoInvalidoError);
    const e = erro as DocumentoInvalidoError;
    return { motivo: e.motivo, mensagem: e.message };
  }
  throw new Error('esperava DocumentoInvalidoError, mas a promessa resolveu');
}

const processoExiste = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** PIDs de todos os filhos criados desde o início do teste. */
const pidsCriados = (): number[] =>
  vi
    .mocked(fork)
    .mock.results.map((r) => (r.type === 'return' ? r.value.pid : undefined))
    .filter((pid): pid is number => pid !== undefined);

describe('ingerirPdfIsolado (processos reais)', () => {
  beforeEach(() => {
    vi.mocked(fork).mockClear();
  });

  it('aula-medicina.pdf: chunks com trilha, sem cabeçalho/rodapé, sha256 correto', async () => {
    const dados = lerPdf('aula-medicina');
    const r = await ingerirPdfIsolado(dados, LIMITES);

    expect(r.sha256).toBe(createHash('sha256').update(dados).digest('hex'));
    expect(r.bytes).toBe(dados.length);
    expect(r.paginas).toBe(6);
    expect(r.chunks.length).toBeGreaterThan(1);
    expect(r.chunks.some((c) => c.trilhaTitulos.length > 0)).toBe(true);
    expect(r.totalCaracteres).toBeGreaterThan(0);

    const tudo = r.chunks.map((c) => c.texto).join('\n');
    expect(tudo).not.toContain('CURSINHO APROVA');
    expect(tudo).not.toMatch(/Página \d+ de/);
    expect(tudo).not.toContain('Faculdade de Medicina — Fisiologia II — Prof. Silva');
  });

  it('o buffer do chamador permanece intacto', async () => {
    const dados = lerPdf('slides');
    const copia = Buffer.from(dados);
    await ingerirPdfIsolado(dados, LIMITES);
    expect(dados.equals(copia)).toBe(true);
  });

  it('escaneado.pdf: motivo escaneado com mensagem clara', async () => {
    const e = await motivoDoErro(ingerirPdfIsolado(lerPdf('escaneado'), LIMITES));
    expect(e.motivo).toBe('escaneado');
    expect(e.mensagem).toContain('escaneado');
  });

  it('corrompido.pdf: motivo corrompido e o processo pai segue vivo', async () => {
    const e = await motivoDoErro(ingerirPdfIsolado(lerPdf('corrompido'), LIMITES));
    expect(e.motivo).toBe('corrompido');
    const depois = await ingerirPdfIsolado(lerPdf('slides'), LIMITES);
    expect(depois.paginas).toBeGreaterThan(0);
  });

  it('arquivo não-PDF: tipo_invalido sem criar filho', async () => {
    const e = await motivoDoErro(ingerirPdfIsolado(readFileSync(resolve(FIXTURES, 'texto', 'colado.txt')), LIMITES));
    expect(e.motivo).toBe('tipo_invalido');
    expect(fork).not.toHaveBeenCalled();
  });

  it('maxBytes pequeno: muito_grande', async () => {
    const e = await motivoDoErro(ingerirPdfIsolado(lerPdf('slides'), { ...LIMITES, maxBytes: 1000 }));
    expect(e.motivo).toBe('muito_grande');
    expect(fork).not.toHaveBeenCalled();
  });

  it('maxPaginas: 3 com PDF de 6 páginas: paginas_demais', async () => {
    const e = await motivoDoErro(ingerirPdfIsolado(lerPdf('aula-medicina'), { ...LIMITES, maxPaginas: 3 }));
    expect(e.motivo).toBe('paginas_demais');
  });

  it('denso-40-paginas.pdf: mede o tempo total pelo runner isolado', async () => {
    const dados = lerPdf('denso-40-paginas');
    const inicio = performance.now();
    const r = await ingerirPdfIsolado(dados, LIMITES);
    const ms = Math.round(performance.now() - inicio);
    console.log(`[T07] denso-40-paginas.pdf: ${ms} ms (${r.paginas} páginas, ${r.chunks.length} chunks, ${r.totalCaracteres} caracteres)`);
    expect(r.paginas).toBe(40);
  });

  it('timeout: SIGKILL, motivo timeout e o filho não existe mais', async () => {
    const e = await motivoDoErro(ingerirPdfIsolado(lerPdf('denso-40-paginas'), { ...LIMITES, timeoutMs: 50 }));
    expect(e.motivo).toBe('timeout');

    const pids = pidsCriados();
    expect(pids).toHaveLength(1);
    for (const pid of pids) expect(processoExiste(pid)).toBe(false);
  });

  it('limite de memória: heap de 16 MB derruba o filho -> corrompido', async () => {
    const e = await motivoDoErro(ingerirPdfIsolado(lerPdf('denso-40-paginas'), { ...LIMITES, maxMemoriaMb: 16 }));
    expect(e.motivo).toBe('corrompido');
    console.log(`[T07] maxMemoriaMb=16 -> ${e.mensagem}`);
  });

  it('sem zumbis: nenhum filho sobrevive, em sucesso, erro ou timeout', async () => {
    await ingerirPdfIsolado(lerPdf('slides'), LIMITES);
    await motivoDoErro(ingerirPdfIsolado(lerPdf('corrompido'), LIMITES));
    await motivoDoErro(ingerirPdfIsolado(lerPdf('denso-40-paginas'), { ...LIMITES, timeoutMs: 50 }));
    const pids = pidsCriados();
    expect(pids).toHaveLength(3);
    for (const pid of pids) expect(processoExiste(pid)).toBe(false);
  });
});

describe('isolamento do ambiente do filho', () => {
  const anterior = process.env.DATABASE_URL;
  beforeAll(() => {
    process.env.DATABASE_URL = 'segredo';
    process.env.ANTHROPIC_API_KEY = 'segredo';
    process.env.S3_SECRET_KEY = 'segredo';
  });
  afterAll(() => {
    if (anterior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = anterior;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.S3_SECRET_KEY;
  });

  it('o filho só enxerga NODE_ENV e PATH', async () => {
    const filho = iniciarProcessoFilho(64);
    const chaves = await new Promise<string[]>((ok, falha) => {
      filho.once('message', (m: { diagnostico: string[] }) => ok(m.diagnostico));
      filho.once('error', falha);
      filho.send({ diagnostico: true });
    });
    await new Promise((ok) => filho.once('exit', ok));

    expect(process.env.DATABASE_URL).toBe('segredo');
    expect(chaves).not.toContain('DATABASE_URL');
    expect(chaves).not.toContain('ANTHROPIC_API_KEY');
    expect(chaves).not.toContain('S3_SECRET_KEY');
    expect(chaves.every((c) => ['NODE_ENV', 'PATH'].includes(c))).toBe(true);
  });
});
