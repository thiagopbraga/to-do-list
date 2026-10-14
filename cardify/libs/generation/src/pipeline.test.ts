import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CardSchema,
  OrcamentoEsgotadoError,
  RespostaLlmInvalidaError,
  type Card,
  type LlmProvider,
  type LlmRequisicao,
  type LlmResposta,
  type ParametrosGeracao,
  type RegistroChamadaLlm,
} from '@cardify/shared';
import { validarCloze } from './cloze';
import { LlmClienteRegistrado } from './llm/cliente';
import { FakeLlmProvider } from './llm/fake';
import { OrcamentoJob } from './llm/orcamento';
import { gerarCards, MAX_CARDS_POR_CHAMADA, regenerarCard, type ChunkPersistido } from './pipeline';

const COLADO = readFileSync(resolve(__dirname, '..', '..', '..', 'fixtures', 'texto', 'colado.txt'), 'utf8');
const PARAGRAFOS = COLADO.split(/\n\n+/).filter((p) => p.trim() !== '');

const TRILHAS = [
  ['Direito Constitucional', 'Princípios fundamentais'],
  ['Direito Constitucional', 'Direitos e garantias', 'Remédios constitucionais'],
  ['Direito Constitucional', 'Organização do Estado'],
  ['Direito Constitucional', 'Controle de constitucionalidade'],
  ['Direito Constitucional', 'Poder constituinte derivado'],
  ['Direito Constitucional', 'Administração Pública'],
];

function chunkDe(indice: number, texto: string, trilha = TRILHAS[indice % TRILHAS.length]!): ChunkPersistido {
  return { id: `chunk-${indice}`, ordem: indice, trilhaTitulos: trilha, texto, tokens: Math.ceil(texto.length / 4) };
}

/** Um chunk por parágrafo do fixture, na ordem de leitura. */
function chunksDoFixture(n: number): ChunkPersistido[] {
  return PARAGRAFOS.slice(0, n).map((texto, i) => chunkDe(i, texto));
}

const PARAMS: ParametrosGeracao = { densidade: 'equilibrado', tipo: 'misto', area: 'direito' };

function montar(provider: LlmProvider = new FakeLlmProvider(), teto = 1000) {
  const registros: RegistroChamadaLlm[] = [];
  const cliente = new LlmClienteRegistrado(provider, { registrar: async (r) => void registros.push(r) });
  const orcamento = new OrcamentoJob(teto);
  const estagios = () => registros.map((r) => r.estagio);
  return { cliente, orcamento, registros, estagios };
}

function entrada(chunks: ChunkPersistido[], orcamento: OrcamentoJob, extra: Partial<ParametrosGeracao> = {}, limiteCards?: number) {
  return {
    jobId: 'job-1',
    chunks,
    parametros: { ...PARAMS, ...extra },
    orcamento,
    ...(limiteCards !== undefined ? { limiteCards } : {}),
  };
}

function resposta(modelo: string, texto: string, tokensOut = 10): LlmResposta {
  return { texto, modelo, tokensIn: 10, tokensOut, latenciaMs: 0 };
}

const FATO_UNICO = 'A mitocôndria é a organela responsável pela respiração celular.';
const CHUNK_UNICO = chunkDe(0, `${FATO_UNICO} Ela possui DNA próprio.`, ['Biologia celular', 'Organelas']);
const EXTRACAO_UNICA = JSON.stringify({ fatos: [{ afirmacao: FATO_UNICO, categoria: 'definicao', fonteOffset: 0 }] });

function cardJson(extra: Partial<Card>): string {
  const card: Card = {
    tipo: 'cloze',
    frente: 'A mitocôndria é a organela responsável pela respiração celular.',
    verso: 'mitocôndria',
    textoCloze: 'A {{c1::mitocôndria}} é a organela responsável pela respiração celular.',
    tagSecao: 'qualquer coisa do LLM',
    fonteOffset: 0,
    ...extra,
  };
  return JSON.stringify({ cards: [card] });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('gerarCards — fluxo completo', () => {
  it('gera cards de 3 chunks, em ordem de chunk, com tagSecao = último título e ledger por estágio', async () => {
    const { cliente, orcamento, estagios } = montar();
    const chunks = [
      chunkDe(0, PARAGRAFOS.slice(0, 2).join('\n\n')),
      chunkDe(1, PARAGRAFOS.slice(2, 4).join('\n\n')),
      chunkDe(2, PARAGRAFOS.slice(4, 6).join('\n\n')),
    ];

    const r = await gerarCards(cliente, entrada(chunks, orcamento));

    expect(r.parcial).toBe(false);
    expect(r.motivoParcial).toBeUndefined();
    expect(r.chunksDescartados).toBe(0);
    expect(r.cards.length).toBeGreaterThan(6);

    const ordens = r.cards.map((c) => chunks.findIndex((ch) => ch.id === c.chunkId));
    expect(ordens).toEqual([...ordens].sort((a, b) => a - b));
    expect(new Set(ordens)).toEqual(new Set([0, 1, 2]));

    for (const card of r.cards) {
      const chunk = chunks.find((ch) => ch.id === card.chunkId)!;
      expect(card.tagSecao).toBe(chunk.trilhaTitulos[chunk.trilhaTitulos.length - 1]);
      expect(card.fonteOffset).toBeLessThanOrEqual(chunk.texto.length);
      expect(CardSchema.safeParse({ ...card, chunkId: undefined }).success).toBe(true);
      if (card.tipo === 'cloze') expect(validarCloze(card.textoCloze!).ok).toBe(true);
      else expect(card.textoCloze).toBeNull();
    }

    const e = estagios();
    expect(e.filter((x) => x === 'extracao')).toHaveLength(3);
    expect(e.filter((x) => x === 'formulacao')).toHaveLength(3);
    expect(new Set(e)).toEqual(new Set(['extracao', 'formulacao']));
  });

  it('ordena pelo campo ordem do chunk, não pela posição no array', async () => {
    const { cliente, orcamento } = montar();
    const chunks = [chunkDe(2, PARAGRAFOS[2]!), chunkDe(0, PARAGRAFOS[0]!), chunkDe(1, PARAGRAFOS[1]!)];

    const r = await gerarCards(cliente, entrada(chunks, orcamento));

    const ids = r.cards.map((c) => c.chunkId);
    const compactado = ids.filter((id, i) => id !== ids[i - 1]);
    expect(compactado).toEqual(['chunk-0', 'chunk-1', 'chunk-2']);
  });

  it('sem chunks devolve resultado vazio sem chamar o LLM', async () => {
    const { cliente, orcamento, registros } = montar();
    const r = await gerarCards(cliente, entrada([], orcamento));
    expect(r).toEqual({ cards: [], parcial: false, chunksDescartados: 0, reparosJson: 0, clozeReprovados: 0, duplicadosRemovidos: 0 });
    expect(registros).toHaveLength(0);
  });

  it('chunk sem fatos pula a formulação', async () => {
    const { cliente, orcamento, estagios } = montar(new FakeLlmProvider());
    const r = await gerarCards(cliente, entrada([chunkDe(0, 'Sem frases longas. Só isto.')], orcamento));
    expect(r.cards).toEqual([]);
    expect(estagios()).toEqual(['extracao']);
  });

  it('processa no máximo 3 chunks ao mesmo tempo', async () => {
    let ativos = 0;
    let pico = 0;
    const base = new FakeLlmProvider();
    const provider: LlmProvider = {
      async completar(req) {
        if (req.tier === 'economico') {
          ativos++;
          pico = Math.max(pico, ativos);
          await new Promise((ok) => setTimeout(ok, 5));
          ativos--;
        }
        return base.completar(req);
      },
    };
    const { cliente, orcamento } = montar(provider);
    await gerarCards(cliente, entrada(chunksDoFixture(9), orcamento));
    expect(pico).toBe(3);
  });
});

describe('gerarCards — preferência de tipo', () => {
  const chunks = () => [chunkDe(0, PARAGRAFOS.slice(0, 3).join('\n\n'))];

  it('basico: nenhum cloze sai', async () => {
    const { cliente, orcamento } = montar();
    const r = await gerarCards(cliente, entrada(chunks(), orcamento, { tipo: 'basico' }));
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.every((c) => c.tipo === 'basico' && c.textoCloze === null)).toBe(true);
  });

  it('cloze: todos os cards do fake saem cloze e válidos', async () => {
    const { cliente, orcamento } = montar();
    const r = await gerarCards(cliente, entrada(chunks(), orcamento, { tipo: 'cloze' }));
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.every((c) => c.tipo === 'cloze' && validarCloze(c.textoCloze!).ok)).toBe(true);
  });

  it('cloze: cards básicos devolvidos pelo LLM são mantidos', async () => {
    const basico = cardJson({ tipo: 'basico', frente: 'O que é a mitocôndria?', verso: 'Organela da respiração celular', textoCloze: null });
    const { cliente, orcamento } = montar(new FakeLlmProvider({ respostas: [EXTRACAO_UNICA, basico] }));
    const r = await gerarCards(cliente, entrada([CHUNK_UNICO], orcamento, { tipo: 'cloze' }));
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({ tipo: 'basico', textoCloze: null, frente: 'O que é a mitocôndria?' });
  });

  it('misto: mistura básicos e cloze', async () => {
    const { cliente, orcamento } = montar();
    const r = await gerarCards(cliente, entrada(chunks(), orcamento, { tipo: 'misto' }));
    const tipos = new Set(r.cards.map((c) => c.tipo));
    expect(tipos).toEqual(new Set(['basico', 'cloze']));
  });

  it('basico: cloze devolvido pelo LLM vira básico com ____ e verso com o ocluído', async () => {
    const texto = 'A {{c1::mitocôndria}} é a organela da {{c2::respiração celular}} nas células eucariontes.';
    const cloze = cardJson({ textoCloze: texto, frente: 'qualquer', verso: 'x' });
    const { cliente, orcamento } = montar(new FakeLlmProvider({ respostas: [EXTRACAO_UNICA, cloze] }));
    const r = await gerarCards(cliente, entrada([CHUNK_UNICO], orcamento, { tipo: 'basico' }));
    expect(r.cards[0]).toMatchObject({
      tipo: 'basico',
      textoCloze: null,
      frente: 'A ____ é a organela da ____ nas células eucariontes.',
      verso: 'mitocôndria; respiração celular',
    });
    expect(r.clozeReprovados).toBe(0);
  });
});

describe('gerarCards — validação de cloze', () => {
  it('cloze inválido é reformulado uma vez com sucesso', async () => {
    const invalido = cardJson({ textoCloze: 'A {{c2::mitocôndria}} é a organela responsável pela respiração celular.' });
    const valido = cardJson({ verso: 'organela', textoCloze: 'A mitocôndria é a {{c1::organela}} responsável pela respiração celular.', tagSecao: 'x', fonteOffset: 999 });
    const { cliente, orcamento, estagios } = montar(new FakeLlmProvider({ respostas: [EXTRACAO_UNICA, invalido, valido] }));

    const r = await gerarCards(cliente, entrada([CHUNK_UNICO], orcamento));

    expect(r.clozeReprovados).toBe(1);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]).toMatchObject({
      tipo: 'cloze',
      textoCloze: 'A mitocôndria é a {{c1::organela}} responsável pela respiração celular.',
      tagSecao: 'Organelas',
      fonteOffset: 0,
    });
    expect(estagios()).toEqual(['extracao', 'formulacao', 'reformulacao_cloze']);
  });

  it('reformulação também inválida converte para básico com ____', async () => {
    const invalido = cardJson({ textoCloze: 'A {{c2::mitocôndria}} é a organela responsável pela respiração celular.' });
    const aindaInvalido = cardJson({ textoCloze: 'A {{c3::mitocôndria}} é a organela responsável pela respiração celular.' });
    const { cliente, orcamento, estagios } = montar(new FakeLlmProvider({ respostas: [EXTRACAO_UNICA, invalido, aindaInvalido] }));

    const r = await gerarCards(cliente, entrada([CHUNK_UNICO], orcamento));

    expect(r.clozeReprovados).toBe(1);
    expect(r.cards[0]).toMatchObject({
      tipo: 'basico',
      textoCloze: null,
      frente: 'A ____ é a organela responsável pela respiração celular.',
      verso: 'mitocôndria',
      tagSecao: 'Organelas',
    });
    expect(estagios().filter((e) => e === 'reformulacao_cloze')).toHaveLength(1);
  });

  it('reformulação com JSON inválido também cai para básico sem descartar o chunk', async () => {
    const invalido = cardJson({ textoCloze: 'sem nenhuma oclusão neste texto longo o bastante' });
    const { cliente, orcamento } = montar(new FakeLlmProvider({ respostas: [EXTRACAO_UNICA, invalido, 'lixo', 'lixo'] }));

    const r = await gerarCards(cliente, entrada([CHUNK_UNICO], orcamento));

    expect(r.chunksDescartados).toBe(0);
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0]!.tipo).toBe('basico');
  });

  it('limita fonteOffset ao tamanho do texto', async () => {
    const { cliente, orcamento } = montar(new FakeLlmProvider({ respostas: [EXTRACAO_UNICA, cardJson({ fonteOffset: 99_999 })] }));
    const r = await gerarCards(cliente, entrada([CHUNK_UNICO], orcamento));
    expect(r.cards[0]!.fonteOffset).toBe(CHUNK_UNICO.texto.length);
  });
});

describe('gerarCards — falhas de JSON', () => {
  const MARCA = 'MARCA_CHUNK_RUIM';

  function providerComChunkRuim(): LlmProvider {
    const base = new FakeLlmProvider();
    return {
      async completar(req: LlmRequisicao) {
        const ruim = req.mensagens.some((m) => m.conteudo.includes(MARCA) || m.conteudo.includes('lixo'));
        return ruim ? resposta('fake-economico', 'lixo não-JSON') : base.completar(req);
      },
    };
  }

  it('JSON inválido duas vezes descarta o chunk e os demais seguem', async () => {
    const { cliente, orcamento, estagios } = montar(providerComChunkRuim());
    const chunks = [chunkDe(0, PARAGRAFOS[0]!), chunkDe(1, `${PARAGRAFOS[1]!} ${MARCA}`), chunkDe(2, PARAGRAFOS[2]!)];

    const r = await gerarCards(cliente, entrada(chunks, orcamento));

    expect(r.chunksDescartados).toBe(1);
    expect(r.parcial).toBe(false);
    expect(new Set(r.cards.map((c) => c.chunkId))).toEqual(new Set(['chunk-0', 'chunk-2']));
    expect(estagios()).toContain('reparo');
    expect(console.warn).toHaveBeenCalledTimes(1);
    const log = String(vi.mocked(console.warn).mock.calls[0]![0]);
    expect(log).toContain('chunk-1');
    expect(log).not.toContain(MARCA);
  });

  it('um reparo bem-sucedido conta em reparosJson', async () => {
    const { cliente, orcamento } = montar(new FakeLlmProvider({ respostas: ['isto não é JSON', EXTRACAO_UNICA] }));
    const r = await gerarCards(cliente, entrada([CHUNK_UNICO], orcamento));
    expect(r.reparosJson).toBe(1);
    expect(r.cards.length).toBeGreaterThan(0);
  });

  it('todos os chunks inválidos relança o último erro', async () => {
    const { cliente, orcamento } = montar(providerComChunkRuim());
    const chunks = [0, 1, 2].map((i) => chunkDe(i, `${PARAGRAFOS[i]!} ${MARCA}`));
    await expect(gerarCards(cliente, entrada(chunks, orcamento))).rejects.toBeInstanceOf(RespostaLlmInvalidaError);
  });

  it('erro de rede num chunk também só descarta o chunk', async () => {
    const base = new FakeLlmProvider();
    const provider: LlmProvider = {
      async completar(req) {
        if (req.mensagens.some((m) => m.conteudo.includes(MARCA))) throw new Error('falha de rede');
        return base.completar(req);
      },
    };
    const { cliente, orcamento } = montar(provider);
    const chunks = [chunkDe(0, PARAGRAFOS[0]!), chunkDe(1, `${PARAGRAFOS[1]!} ${MARCA}`)];
    const r = await gerarCards(cliente, entrada(chunks, orcamento));
    expect(r.chunksDescartados).toBe(1);
    expect(r.cards.every((c) => c.chunkId === 'chunk-0')).toBe(true);
  });
});

describe('gerarCards — orçamento', () => {
  /** Chamadas do tier forte custam caro de verdade (modelo conhecido, muitos tokens de saída). */
  function providerCaro(): LlmProvider {
    const base = new FakeLlmProvider();
    return {
      async completar(req) {
        const r = await base.completar(req);
        return req.tier === 'forte' ? { ...r, modelo: 'claude-sonnet-5-5', tokensOut: 20_000 } : r;
      },
    };
  }

  it('estouro no meio do job devolve o parcial sem lançar', async () => {
    const { cliente, orcamento, estagios } = montar(providerCaro(), 150);
    const chunks = chunksDoFixture(9);

    const r = await gerarCards(cliente, entrada(chunks, orcamento));

    expect(r.parcial).toBe(true);
    expect(r.motivoParcial).toBe('orcamento');
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.chunksDescartados).toBe(0);
    expect(estagios().filter((e) => e === 'extracao').length).toBeLessThan(chunks.length);
    expect(r.cards.every((c) => chunks.some((ch) => ch.id === c.chunkId))).toBe(true);
  });

  it('orçamento menor que a primeira estimativa devolve parcial vazio', async () => {
    const { cliente, orcamento, registros } = montar(new FakeLlmProvider(), 0.0001);
    const r = await gerarCards(cliente, entrada(chunksDoFixture(5), orcamento));
    expect(r).toMatchObject({ parcial: true, motivoParcial: 'orcamento', cards: [], chunksDescartados: 0 });
    expect(registros).toHaveLength(0);
  });

  it('OrcamentoEsgotadoError vindo do cliente não conta como chunk descartado', async () => {
    const cliente = {
      chamar: async () => {
        throw new OrcamentoEsgotadoError(1, 1);
      },
    };
    const r = await gerarCards(cliente, entrada(chunksDoFixture(2), new OrcamentoJob(1)));
    expect(r.parcial).toBe(true);
    expect(r.chunksDescartados).toBe(0);
  });
});

describe('gerarCards — limiteCards e dedup', () => {
  it('corta em limiteCards e para de iniciar chunks', async () => {
    const { cliente, orcamento, estagios } = montar();
    const chunks = chunksDoFixture(10);

    const r = await gerarCards(cliente, entrada(chunks, orcamento, {}, 10));

    expect(r.cards).toHaveLength(10);
    expect(r.parcial).toBe(true);
    expect(r.motivoParcial).toBe('limite_cards');
    expect(estagios().filter((e) => e === 'extracao').length).toBeLessThan(chunks.length);
  });

  it('limite maior que o total gerado não marca parcial', async () => {
    const { cliente, orcamento } = montar();
    const r = await gerarCards(cliente, entrada(chunksDoFixture(2), orcamento, {}, 500));
    expect(r.parcial).toBe(false);
    expect(r.motivoParcial).toBeUndefined();
  });

  it('remove duplicatas de chunks com texto sobreposto', async () => {
    const texto = PARAGRAFOS.slice(0, 2).join('\n\n');
    const sozinho = await gerarCards(montar().cliente, entrada([chunkDe(0, texto)], new OrcamentoJob(1000)));

    const { cliente, orcamento } = montar();
    const r = await gerarCards(cliente, entrada([chunkDe(0, texto), chunkDe(1, texto)], orcamento));

    expect(sozinho.cards.length).toBeGreaterThan(0);
    expect(r.cards).toHaveLength(sozinho.cards.length);
    expect(r.duplicadosRemovidos).toBeGreaterThanOrEqual(sozinho.cards.length);
    expect(r.cards.every((c) => c.chunkId === 'chunk-0')).toBe(true);
  });
});

describe('gerarCards — progresso', () => {
  it('chama aoProgredir uma vez por chunk com contagens crescentes', async () => {
    const { cliente, orcamento } = montar();
    const chamadas: [number, number, number][] = [];
    const aoProgredir = vi.fn(async (feitos: number, total: number, cards: number) => {
      await new Promise((ok) => setTimeout(ok, 1));
      chamadas.push([feitos, total, cards]);
    });

    const r = await gerarCards(cliente, entrada(chunksDoFixture(5), orcamento), aoProgredir);

    expect(aoProgredir).toHaveBeenCalledTimes(5);
    expect(chamadas.map((c) => c[0])).toEqual([1, 2, 3, 4, 5]);
    expect(chamadas.every((c) => c[1] === 5)).toBe(true);
    const cards = chamadas.map((c) => c[2]);
    expect(cards).toEqual([...cards].sort((a, b) => a - b));
    expect(cards[4]).toBeGreaterThanOrEqual(r.cards.length);
  });

  it('chunk descartado também conta como feito', async () => {
    const { cliente, orcamento } = montar(new FakeLlmProvider({ respostas: ['lixo', 'lixo'] }));
    const aoProgredir = vi.fn();
    const chunks = [chunkDe(0, PARAGRAFOS[0]!), chunkDe(1, PARAGRAFOS[1]!)];
    await gerarCards(cliente, entrada(chunks, orcamento), aoProgredir);
    expect(aoProgredir.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });
});

describe('regenerarCard', () => {
  const chunk = chunkDe(0, PARAGRAFOS.slice(0, 2).join('\n\n'), ['Direito Constitucional', 'Princípios fundamentais']);

  async function cardsDoChunk() {
    const { cliente, orcamento } = montar();
    const r = await gerarCards(cliente, entrada([chunk], orcamento));
    return r.cards;
  }

  it('devolve card válido do mesmo tipo (cloze e básico)', async () => {
    const cards = await cardsDoChunk();
    const { cliente, orcamento, registros } = montar();

    for (const tipo of ['cloze', 'basico'] as const) {
      const original = cards.find((c) => c.tipo === tipo)!;
      const novo = await regenerarCard(cliente, { jobId: 'job-1', orcamento }, original, chunk, PARAMS);

      expect(novo.tipo).toBe(tipo);
      expect(CardSchema.safeParse(novo).success).toBe(true);
      expect(novo.tagSecao).toBe('Princípios fundamentais');
      expect(novo.fonteOffset).toBe(original.fonteOffset);
      if (tipo === 'cloze') expect(validarCloze(novo.textoCloze!).ok).toBe(true);
      else expect(novo.textoCloze).toBeNull();
    }
    expect(registros.map((r) => r.estagio)).toEqual(['regeneracao', 'regeneracao']);
  });

  it('preferência básico transforma a regeneração de um cloze em básico', async () => {
    const cards = await cardsDoChunk();
    const { cliente, orcamento } = montar();
    const cloze = cards.find((c) => c.tipo === 'cloze')!;
    const novo = await regenerarCard(cliente, { jobId: 'job-1', orcamento }, cloze, chunk, { ...PARAMS, tipo: 'basico' });
    expect(novo.tipo).toBe('basico');
    expect(novo.textoCloze).toBeNull();
  });

  it('cloze inválido na regeneração passa pela reformulação e depois vira básico', async () => {
    const cards = await cardsDoChunk();
    const cloze = cards.find((c) => c.tipo === 'cloze')!;
    const invalido = cardJson({ textoCloze: 'A {{c2::mitocôndria}} é a organela responsável pela respiração celular.' });
    const { cliente, orcamento, estagios } = montar(new FakeLlmProvider({ respostas: [invalido, invalido] }));

    const novo = await regenerarCard(cliente, { jobId: 'job-1', orcamento }, cloze, chunk, PARAMS);

    expect(novo.tipo).toBe('basico');
    expect(novo.frente).toBe('A ____ é a organela responsável pela respiração celular.');
    expect(estagios()).toEqual(['regeneracao', 'reformulacao_cloze']);
  });
});

describe('meta de cards limitada pelo teto do job', () => {
  it('amostra com orçamento de 15 centavos e texto longo num chunk só gera os 10 cards (estimativa pelo preço do modelo forte)', async () => {
    const { cliente, orcamento } = montar(new FakeLlmProvider(), 15);
    const unico = chunkDe(0, PARAGRAFOS.join('\n\n'), ['Direito Constitucional']);

    const resultado = await gerarCards(cliente, entrada([unico], orcamento, {}, 10));

    expect(resultado.cards).toHaveLength(10);
    expect(resultado.motivoParcial).toBe('limite_cards');
  });

  it(`nunca pede mais que ${MAX_CARDS_POR_CHAMADA} cards numa chamada`, async () => {
    const pedidos: string[] = [];
    const base = new FakeLlmProvider();
    const espiao: LlmProvider = {
      completar: async (req) => {
        if (req.tier === 'forte') pedidos.push(req.mensagens.at(-1)?.conteudo ?? '');
        return base.completar(req);
      },
    };
    const { cliente, orcamento } = montar(espiao);
    const unico = chunkDe(0, PARAGRAFOS.join('\n\n'), ['Direito Constitucional']);

    await gerarCards(cliente, entrada([unico], orcamento, { densidade: 'exaustivo' }));

    const metas = pedidos.map((p) => Number(/aproximadamente (\d+) cards/.exec(p)?.[1]));
    expect(metas.length).toBeGreaterThan(0);
    expect(Math.max(...metas)).toBeLessThanOrEqual(MAX_CARDS_POR_CHAMADA);
  });
});
