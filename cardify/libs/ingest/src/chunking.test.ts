import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHUNKING, type ChunkDocumento, type DocumentoExtraido, type LinhaPdf } from '@cardify/shared';
import { chunkDocumento, chunkTexto, contarTokens, detectarTitulos } from './chunking';

const RAIZ_FIXTURES = join(__dirname, '..', '..', '..', 'fixtures');

interface LinhaEsperada {
  pagina: number;
  texto: string;
  fonteTamanho: number;
  negrito: boolean;
  ruido: boolean;
}

interface Esperado {
  linhas: LinhaEsperada[];
  titulos: Array<{ texto: string; nivel: number }>;
}

function carregarEsperado(nome: string): Esperado {
  return JSON.parse(readFileSync(join(RAIZ_FIXTURES, 'pdf', `${nome}.esperado.json`), 'utf8')) as Esperado;
}

function linha(texto: string, fonteTamanho: number, negrito = false): LinhaPdf {
  return { texto, fonteTamanho, negrito, yNorm: 0.5, xNorm: 0.1 };
}

function documentoDeLinhas(linhas: Array<{ pagina: number; linha: LinhaPdf }>): DocumentoExtraido {
  const numeros = [...new Set(linhas.map((l) => l.pagina))].sort((a, b) => a - b);
  const paginas = numeros.map((numero) => ({
    numero,
    largura: 595,
    altura: 842,
    linhas: linhas.filter((l) => l.pagina === numero).map((l) => l.linha),
  }));
  const totalCaracteres = linhas.reduce((soma, l) => soma + l.linha.texto.length, 0);
  return { paginas, totalCaracteres, escaneado: false };
}

function carregarDocumento(nome: string): { doc: DocumentoExtraido; esperado: Esperado } {
  const esperado = carregarEsperado(nome);
  const linhas = esperado.linhas
    .filter((l) => !l.ruido)
    .map((l) => ({ pagina: l.pagina, linha: linha(l.texto, l.fonteTamanho, l.negrito) }));
  return { doc: documentoDeLinhas(linhas), esperado };
}

function imprimirEstatisticas(nome: string, chunks: ChunkDocumento[]): void {
  const media = chunks.length ? Math.round(chunks.reduce((s, c) => s + c.tokens, 0) / chunks.length) : 0;
  console.log(
    `[chunking] ${nome}: ${chunks.length} chunks, ${media} tokens médios (min ${Math.min(...chunks.map((c) => c.tokens))}, max ${Math.max(...chunks.map((c) => c.tokens))})`,
  );
}

function normalizarEspacos(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

function frasesDoCorpo(esperado: Esperado, tamanhoMaximoCorpo: number): string[] {
  const corpo = esperado.linhas
    .filter((l) => !l.ruido && l.fonteTamanho <= tamanhoMaximoCorpo)
    .map((l) => l.texto)
    .join(' ');
  return normalizarEspacos(corpo)
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => frase.length > 20);
}

function amostrar<T>(itens: T[], quantidade: number): T[] {
  const passo = Math.max(1, Math.floor(itens.length / quantidade));
  return itens.filter((_, indice) => indice % passo === 0).slice(0, quantidade);
}

describe('contarTokens', () => {
  it('conta tokens e trata marcadores especiais como texto comum', () => {
    expect(contarTokens('')).toBe(0);
    expect(contarTokens('Olá, mundo')).toBeGreaterThan(1);
    expect(contarTokens('a <|endoftext|> b')).toBeGreaterThan(3);
  });
});

describe('chunkDocumento — aula-medicina', () => {
  const { doc, esperado } = carregarDocumento('aula-medicina');
  const chunks = chunkDocumento(doc);

  it('detecta os títulos e níveis esperados', () => {
    imprimirEstatisticas('aula-medicina', chunks);
    expect(detectarTitulos(doc)).toEqual(esperado.titulos);
  });

  it('toda trilha é não vazia e os chunks respeitam os limites de tamanho', () => {
    const total = contarTokens(chunks.map((c) => c.texto).join('\n\n'));
    for (const chunk of chunks) {
      expect(chunk.trilhaTitulos.length).toBeGreaterThan(0);
      expect(chunk.tokens).toBeLessThanOrEqual(CHUNKING.maxTokens);
      if (total >= CHUNKING.minTokens) expect(chunk.tokens).toBeGreaterThanOrEqual(CHUNKING.minTokens);
      expect(chunk.tokens).toBe(contarTokens(chunk.texto));
    }
    expect(chunks.map((c) => c.ordem)).toEqual(chunks.map((_, i) => i));
  });

  it('não repete o título no texto do chunk', () => {
    for (const chunk of chunks) {
      expect(chunk.texto).not.toContain('Fisiologia Cardiovascular: Fundamentos');
    }
  });
});

describe('chunkDocumento — denso-40-paginas', () => {
  const { doc, esperado } = carregarDocumento('denso-40-paginas');
  const chunks = chunkDocumento(doc);

  it('mantém chunks ≤ 2000 tokens e trilhas de até 3 níveis', () => {
    imprimirEstatisticas('denso-40-paginas', chunks);
    expect(detectarTitulos(doc)).toEqual(esperado.titulos);
    for (const chunk of chunks) {
      expect(chunk.tokens).toBeLessThanOrEqual(CHUNKING.maxTokens);
      expect(chunk.tokens).toBeGreaterThanOrEqual(CHUNKING.minTokens);
      expect(chunk.trilhaTitulos.length).toBeGreaterThan(0);
      expect(chunk.trilhaTitulos.length).toBeLessThanOrEqual(3);
    }
  });

  it('não perde frases do corpo (amostra de 30)', () => {
    const texto = normalizarEspacos(chunks.map((c) => c.texto).join(' '));
    const amostra = amostrar(frasesDoCorpo(esperado, 12), 30);
    expect(amostra).toHaveLength(30);
    for (const frase of amostra) expect(texto).toContain(frase);
  });
});

describe('chunkDocumento — lei-seca (sem estrutura de fonte)', () => {
  const { doc, esperado } = carregarDocumento('lei-seca');
  const chunks = chunkDocumento(doc);

  it('cai no fallback por parágrafos, sem trilha, entre 200 e 2000 tokens', () => {
    imprimirEstatisticas('lei-seca', chunks);
    expect(esperado.titulos).toEqual([]);
    expect(detectarTitulos(doc)).toEqual([]);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.trilhaTitulos).toEqual([]);
      expect(chunk.tokens).toBeGreaterThanOrEqual(CHUNKING.minTokens);
      expect(chunk.tokens).toBeLessThanOrEqual(CHUNKING.maxTokens);
    }
  });

  it('separa artigos e incisos em parágrafos', () => {
    const texto = chunks.map((c) => c.texto).join('\n\n');
    expect(texto).toContain('\n\nArt. 2º Os tributos de competência do Município são:');
    expect(texto).toContain('\n\nI – impostos;');
    expect(texto).toContain('TÍTULO I – DAS DISPOSIÇÕES GERAIS\n\nArt. 1º');
    expect(texto).toContain('normas gerais de direito tributário');
  });
});

describe('chunkDocumento — slides', () => {
  const { doc, esperado } = carregarDocumento('slides');
  const chunks = chunkDocumento(doc);

  it('títulos de 28pt viram nível 1 e bullets ficam no corpo', () => {
    imprimirEstatisticas('slides', chunks);
    const titulos = detectarTitulos(doc);
    expect(titulos).toEqual(esperado.titulos);
    expect(titulos.every((t) => t.nivel === 1)).toBe(true);

    expect(chunks).toHaveLength(esperado.titulos.length);
    chunks.forEach((chunk, indice) => {
      expect(chunk.trilhaTitulos).toEqual([esperado.titulos[indice].texto]);
      expect(chunk.texto).toContain('• ');
      expect(chunk.texto).not.toContain(esperado.titulos[indice].texto);
      expect(chunk.texto.split('\n\n').every((p) => p.startsWith('• '))).toBe(true);
    });
  });
});

describe('chunkDocumento — hierarquia e trilhas', () => {
  const paragrafo = (inicio: string) =>
    `${inicio} ${'O débito cardíaco depende da frequência e do volume sistólico do paciente. '.repeat(16)}`.trim();

  function docSintetico(): DocumentoExtraido {
    const itens: Array<[string, number]> = [
      ['Capítulo A', 20],
      ['Seção A1', 16],
      ['Sub A1a', 13],
      [paragrafo('Corpo um.'), 11],
      ['Seção A2', 16],
      [paragrafo('Corpo dois.'), 11],
      ['Capítulo B', 20],
      [paragrafo('Corpo três.'), 11],
    ];
    return documentoDeLinhas(itens.map(([texto, tamanho]) => ({ pagina: 1, linha: linha(texto, tamanho, tamanho > 11) })));
  }

  it('título de nível n substitui o n e descarta os mais profundos', () => {
    const chunks = chunkDocumento(docSintetico());
    expect(chunks.map((c) => c.trilhaTitulos)).toEqual([
      ['Capítulo A', 'Seção A1', 'Sub A1a'],
      ['Capítulo A', 'Seção A2'],
      ['Capítulo B'],
    ]);
  });

  it('título quebrado em duas linhas de mesmo tamanho vira um título só', () => {
    const doc = documentoDeLinhas([
      { pagina: 1, linha: linha('Fisiologia do Sistema', 20, true) },
      { pagina: 1, linha: linha('Cardiovascular Humano', 20, true) },
      { pagina: 1, linha: linha(paragrafo('Corpo um.'), 11) },
      { pagina: 1, linha: linha('Outro Capítulo', 20, true) },
      { pagina: 1, linha: linha(paragrafo('Corpo dois.'), 11) },
    ]);
    expect(detectarTitulos(doc)).toEqual([
      { texto: 'Fisiologia do Sistema Cardiovascular Humano', nivel: 1 },
      { texto: 'Outro Capítulo', nivel: 1 },
    ]);
    expect(chunkDocumento(doc).map((c) => c.trilhaTitulos)).toEqual([
      ['Fisiologia do Sistema Cardiovascular Humano'],
      ['Outro Capítulo'],
    ]);
  });

  it('limita a 3 níveis e junta hifenização de fim de linha', () => {
    const doc = documentoDeLinhas([
      { pagina: 1, linha: linha('N1', 24, true) },
      { pagina: 1, linha: linha('N2', 20, true) },
      { pagina: 1, linha: linha('N3', 16, true) },
      { pagina: 1, linha: linha('N4', 13, true) },
      { pagina: 1, linha: linha('A hiper-', 11) },
      { pagina: 1, linha: linha('tensão arterial é comum.', 11) },
      { pagina: 1, linha: linha('Outra frase aqui sem relação, longa o bastante para ser corpo dominante.', 11) },
    ]);
    expect(detectarTitulos(doc).map((t) => t.nivel)).toEqual([1, 2, 3, 3]);
    expect(chunkDocumento(doc)[0].texto).toContain('A hipertensão arterial é comum.\n\nOutra frase');
  });
});

describe('chunkDocumento — subdivisão com sobreposição', () => {
  function frase(n: number): string {
    return `A estrutura numero ${n} do modelo fisiológico descreve o mecanismo ${n * 7} com o parâmetro ${n * 13}.`;
  }

  function paragrafoSintetico(inicio: number, frases: number): string {
    return Array.from({ length: frases }, (_, i) => frase(inicio + i)).join(' ');
  }

  function ultimoSobreposto(anterior: string, proximo: string): string {
    const limite = Math.min(anterior.length, proximo.length, 2500);
    for (let tamanho = limite; tamanho > 0; tamanho--) {
      const prefixo = proximo.slice(0, tamanho);
      if (anterior.endsWith(prefixo)) return prefixo;
    }
    return '';
  }

  it('bloco de ~5.000 tokens gera ≥3 chunks e cada início repete o fim do anterior com ≤ 120 tokens', () => {
    const paragrafos = Array.from({ length: 40 }, (_, i) => paragrafoSintetico(i * 6, 6));
    const texto = paragrafos.join('\n\n');
    expect(contarTokens(texto)).toBeGreaterThan(4000);

    const chunks = chunkTexto(texto);
    imprimirEstatisticas('sintetico-5000', chunks);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) expect(chunk.tokens).toBeLessThanOrEqual(CHUNKING.maxTokens);

    for (let i = 1; i < chunks.length; i++) {
      const repetido = ultimoSobreposto(chunks[i - 1].texto, chunks[i].texto);
      const tokens = contarTokens(repetido);
      expect(tokens).toBeGreaterThan(20);
      expect(tokens).toBeLessThanOrEqual(CHUNKING.sobreposicaoTokens);
    }

    const todas = normalizarEspacos(chunks.map((c) => c.texto).join(' '));
    for (let i = 0; i < 240; i += 7) expect(todas).toContain(frase(i));
  });

  it('subdivide em um documento com títulos (bloco único longo) mantendo a trilha', () => {
    const corpo = Array.from({ length: 40 }, (_, i) => paragrafoSintetico(i * 6, 6));
    const linhas = [
      { pagina: 1, linha: linha('Capítulo Longo', 20, true) },
      ...corpo.map((p) => ({ pagina: 1, linha: linha(p, 11) })),
      { pagina: 2, linha: linha('Capítulo Curto', 20, true) },
      { pagina: 2, linha: linha(paragrafoSintetico(500, 12), 11) },
    ];
    const chunks = chunkDocumento(documentoDeLinhas(linhas));
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks[0].trilhaTitulos).toEqual(['Capítulo Longo']);
    expect(chunks[chunks.length - 1].trilhaTitulos).toEqual(['Capítulo Curto']);
    for (const chunk of chunks) expect(chunk.tokens).toBeLessThanOrEqual(CHUNKING.maxTokens);
  });

  it('divide por frases um parágrafo único maior que o limite', () => {
    const paragrafoGigante = paragrafoSintetico(0, 150);
    expect(contarTokens(paragrafoGigante)).toBeGreaterThan(CHUNKING.maxTokens);
    const chunks = chunkTexto(paragrafoGigante);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) expect(chunk.tokens).toBeLessThanOrEqual(CHUNKING.maxTokens);
  });
});

describe('chunkTexto', () => {
  const texto = readFileSync(join(RAIZ_FIXTURES, 'texto', 'colado.txt'), 'utf8');

  it('agrupa parágrafos do texto colado sem trilha', () => {
    const chunks = chunkTexto(texto);
    imprimirEstatisticas('colado.txt', chunks);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    chunks.forEach((chunk, indice) => {
      expect(chunk.ordem).toBe(indice);
      expect(chunk.trilhaTitulos).toEqual([]);
      expect(chunk.tokens).toBeLessThanOrEqual(CHUNKING.maxTokens);
      expect(chunk.tokens).toBe(contarTokens(chunk.texto));
    });
    const paragrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const unido = chunks.map((c) => c.texto).join('\n\n');
    for (const paragrafo of paragrafos) expect(unido).toContain(paragrafo);
  });

  it('normaliza CRLF e ignora texto vazio', () => {
    expect(chunkTexto('')).toEqual([]);
    expect(chunkTexto('   \r\n\r\n  ')).toEqual([]);
    const chunks = chunkTexto('Primeiro parágrafo.\r\n\r\nSegundo parágrafo.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].texto).toBe('Primeiro parágrafo.\n\nSegundo parágrafo.');
  });
});
