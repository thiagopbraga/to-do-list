import {
  CLOZE_REGEX,
  MODEL_ID_BASICO,
  MODEL_ID_CLOZE,
  NOTE_TYPE_NOME_BASICO,
  NOTE_TYPE_NOME_CLOZE,
  type NotaExportavel,
  type PacoteBaralho,
} from '@cardify/shared';
import { exportarDelimitado } from './delimitado';
import { AnkiApkgPacker, csumCampo, guidDoCard } from './packer';
import {
  AreaTemporaria,
  exigirAmbienteAnki,
  importarApkg,
  importarCsv,
  type ResultadoImportacao,
} from './testing/anki';
import { lerBanco, lerColecaoDoApkg, type ColecaoLida } from './testing/colecao';
import {
  ATUALIZADO_EM_BASE,
  ATUALIZADO_EM_POSTERIOR,
  NOMES_FIXTURES,
  RELOGIO_EXPORTACAO_1,
  RELOGIO_EXPORTACAO_2,
  montarNotasDoFixture,
  montarPacoteDoFixture,
  uuidDeterministico,
  type NomeFixture,
} from './testing/fixtures';

// Gate da RFC-001 §9: Python/Anki de verdade, um processo por importação.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const area = new AreaTemporaria();
afterAll(() => area.limpar());

// ───────────────────────────── expectativas calculadas à parte do empacotador ─────────────────────────────

function indicesDistintos(textoCloze: string): number[] {
  return [...new Set([...textoCloze.matchAll(/\{\{c(\d+)::/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

function cardsEsperados(nota: NotaExportavel): number {
  return nota.tipo === 'cloze' ? indicesDistintos(nota.textoCloze ?? '').length : 1;
}

function totalDeCards(notas: NotaExportavel[]): number {
  return notas.reduce((soma, nota) => soma + cardsEsperados(nota), 0);
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r\n?|\n/g, '<br>');
}

function camposEsperados(nota: NotaExportavel): string[] {
  return nota.tipo === 'cloze' ? [escaparHtml(nota.textoCloze ?? ''), ''] : [escaparHtml(nota.frente), escaparHtml(nota.verso)];
}

function primeiroCampo(nota: NotaExportavel): string {
  return nota.tipo === 'cloze' ? (nota.textoCloze ?? '') : nota.frente;
}

/**
 * `sfld` que o Anki calcula (observado ao importar): primeiro campo sem HTML. As tags somem sem deixar espaço,
 * então `<br>` (quebra de linha) não vira espaço. `csum` = csumCampo(sfld).
 */
function sfldDoAnki(texto: string): string {
  return texto.replace(/\r\n?|\n/g, '').trim();
}

function temQuebraNoPrimeiroCampo(nota: NotaExportavel): boolean {
  return /[\r\n]/.test(primeiroCampo(nota));
}

function deckEsperado(pacote: PacoteBaralho, nota: NotaExportavel): string {
  return [pacote.nomeBaralho, ...nota.trilhaTitulos.slice(0, 3)].join('::');
}

/** Raiz + todos os subdecks (inclusive os intermediários) que as notas exigem. */
function decksEsperados(pacote: PacoteBaralho): string[] {
  const nomes = new Set<string>([pacote.nomeBaralho]);
  for (const nota of pacote.notas) {
    const partes = deckEsperado(pacote, nota).split('::');
    for (let i = 1; i <= partes.length; i++) nomes.add(partes.slice(0, i).join('::'));
  }
  return [...nomes].sort();
}

function nomeNoteTypeEsperado(nota: NotaExportavel): string {
  return nota.tipo === 'cloze' ? NOTE_TYPE_NOME_CLOZE : NOTE_TYPE_NOME_BASICO;
}

function contagemPorNoteType(notas: NotaExportavel[]): Array<{ nome: string; tipo: string; notas: number }> {
  const basicas = notas.filter((n) => n.tipo === 'basico').length;
  const clozes = notas.length - basicas;
  return [
    { nome: NOTE_TYPE_NOME_BASICO, tipo: 'basico', notas: basicas },
    { nome: NOTE_TYPE_NOME_CLOZE, tipo: 'cloze', notas: clozes },
  ].filter((linha) => linha.notas > 0);
}

function empacotar(pacote: PacoteBaralho, relogio = RELOGIO_EXPORTACAO_1): Promise<Buffer> {
  return new AnkiApkgPacker({ agora: relogio }).empacotar(pacote);
}

function emSegundos(data: Date): number {
  return Math.floor(data.getTime() / 1000);
}

function ordenadas<T>(valores: T[]): T[] {
  return [...valores].sort();
}

// ───────────────────────────── pré-condição ─────────────────────────────

describe('pré-condição do ambiente Python/Anki', () => {
  it('tools/anki/.venv existe e tem a biblioteca anki (senão: rodar tools/anki/preparar.sh)', async () => {
    await exigirAmbienteAnki();
  });

  it('sem o venv a suíte falha com mensagem que manda rodar preparar.sh (nunca pula)', async () => {
    const original = process.env.CARDIFY_ANKI_PYTHON;
    process.env.CARDIFY_ANKI_PYTHON = '/caminho/que/nao/existe/python';
    try {
      await expect(exigirAmbienteAnki()).rejects.toThrow(/tools\/anki\/preparar\.sh/);
    } finally {
      if (original === undefined) delete process.env.CARDIFY_ANKI_PYTHON;
      else process.env.CARDIFY_ANKI_PYTHON = original;
    }
  });
});

// ───────────────────────────── por fixture ─────────────────────────────

describe.each(NOMES_FIXTURES)('fixture %s', (nome: NomeFixture) => {
  let notas: NotaExportavel[];
  let pacote: PacoteBaralho;
  let apkg: Buffer;

  beforeAll(async () => {
    await exigirAmbienteAnki();
    notas = montarNotasDoFixture(nome);
    pacote = montarPacoteDoFixture(nome, notas);
    apkg = await empacotar(pacote);
  });

  it('o fixture gera notas básicas e cloze, com c2 e com caracteres especiais', () => {
    expect(notas.length).toBeGreaterThanOrEqual(15);
    expect(new Set(notas.map((n) => n.id)).size).toBe(notas.length);
    for (const nota of notas) expect(nota.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const clozes = notas.filter((n) => n.tipo === 'cloze');
    expect(notas.some((n) => n.tipo === 'basico')).toBe(true);
    expect(clozes.length).toBeGreaterThan(0);
    expect(clozes.some((n) => indicesDistintos(n.textoCloze ?? '').length >= 2)).toBe(true);
    const textos = notas.map((n) => `${n.frente}${n.verso}${n.textoCloze ?? ''}`).join('\n');
    expect(textos).toMatch(/&/);
    expect(textos).toMatch(/</);
    expect(textos).toMatch(/"/);
    expect(textos).toMatch(/\n/);
  });

  // ─────────── itens 1, 2 e 5: abrir o zip e ler collection.anki2 com better-sqlite3 ───────────

  describe('conteúdo do .apkg (zip + better-sqlite3)', () => {
    let arquivos: Map<string, Buffer>;
    let colecao: ColecaoLida;

    beforeAll(async () => {
      ({ arquivos, colecao } = await lerColecaoDoApkg(apkg));
    });

    it('o zip tem exatamente collection.anki2 e media', () => {
      expect(ordenadas([...arquivos.keys()])).toEqual(['collection.anki2', 'media']);
      expect(arquivos.get('media')?.toString('utf8')).toBe('{}');
    });

    it('contagem de notas e de linhas em cards', () => {
      expect(colecao.notas).toHaveLength(notas.length);
      expect(colecao.cards).toHaveLength(totalDeCards(notas));
    });

    it('cada nota tem mid, guid, csum, sfld, flds e mod corretos (primeiro campo sem quebra de linha)', () => {
      const porGuid = new Map(colecao.notas.map((n) => [n.guid, n]));
      expect(porGuid.size).toBe(notas.length);
      expect(new Set(colecao.notas.map((n) => n.id)).size).toBe(notas.length);
      for (const nota of notas) {
        const linha = porGuid.get(guidDoCard(nota.id));
        expect(linha, `nota ${nota.id} sem guid ${guidDoCard(nota.id)}`).toBeDefined();
        if (!linha) continue;
        expect(linha.mid).toBe(nota.tipo === 'cloze' ? MODEL_ID_CLOZE : MODEL_ID_BASICO);
        if (!temQuebraNoPrimeiroCampo(nota)) {
          expect(linha.sfld).toBe(sfldDoAnki(primeiroCampo(nota)));
          expect(linha.csum).toBe(csumCampo(sfldDoAnki(primeiroCampo(nota))));
        }
        expect(linha.flds.split('\x1f')).toEqual(camposEsperados(nota));
        expect(linha.mod).toBe(emSegundos(ATUALIZADO_EM_BASE));
        expect(linha.tags.startsWith(' ') && linha.tags.endsWith(' ')).toBe(true);
        expect(linha.tags).toContain(` cardify::fixture-${nome} `);
      }
    });

    // O Anki recalcula sfld/csum ao importar e remove o <br> sem deixar espaço; o empacotador troca <br> por espaço
    // (packer.ts, textoPuro). Efeito prático pequeno (o Anki sobrescreve ao importar), mas o csum do arquivo
    // diverge do que o Anki calcularia. Corrigir textoPuro faz este teste passar a falhar: remover o it.fails.
    it('sfld/csum de notas com quebra de linha no primeiro campo iguais aos do Anki', () => {
      const porGuid = new Map(colecao.notas.map((n) => [n.guid, n]));
      const comQuebra = notas.filter(temQuebraNoPrimeiroCampo);
      expect(comQuebra.length).toBeGreaterThan(0);
      for (const nota of comQuebra) {
        const linha = porGuid.get(guidDoCard(nota.id));
        expect(linha?.sfld).toBe(sfldDoAnki(primeiroCampo(nota)));
        expect(linha?.csum).toBe(csumCampo(sfldDoAnki(primeiroCampo(nota))));
      }
    });

    it('os note types do pacote são exatamente os dois do Cardify, com id e nome fixos', () => {
      expect(Object.keys(colecao.models).sort()).toEqual([String(MODEL_ID_BASICO), String(MODEL_ID_CLOZE)]);
      expect(colecao.models[String(MODEL_ID_BASICO)]).toMatchObject({ name: NOTE_TYPE_NOME_BASICO, type: 0 });
      expect(colecao.models[String(MODEL_ID_CLOZE)]).toMatchObject({ name: NOTE_TYPE_NOME_CLOZE, type: 1 });
    });

    it('cada card aponta para uma nota existente e para o deck da trilha de títulos', () => {
      const porId = new Map(colecao.notas.map((n) => [n.id, n]));
      const idPorGuid = new Map(notas.map((n) => [guidDoCard(n.id), n]));
      for (const card of colecao.cards) {
        const linha = porId.get(card.nid);
        expect(linha, `card ${card.id} órfão`).toBeDefined();
        const nota = linha ? idPorGuid.get(linha.guid) : undefined;
        expect(nota).toBeDefined();
        if (nota) expect(colecao.decks[String(card.did)]?.name).toBe(deckEsperado(pacote, nota));
      }
      const nomesDecks = Object.values(colecao.decks).map((d) => d.name);
      for (const esperado of decksEsperados(pacote)) expect(nomesDecks).toContain(esperado);
    });

    it('toda nota cloze: mid = MODEL_ID_CLOZE, campo casa com o regex de oclusão e cards = índices distintos', () => {
      const regex = new RegExp(CLOZE_REGEX.source);
      const cardsPorNota = new Map<number, number[]>();
      for (const card of colecao.cards) cardsPorNota.set(card.nid, [...(cardsPorNota.get(card.nid) ?? []), card.ord]);

      const clozes = colecao.notas.filter((n) => n.mid === MODEL_ID_CLOZE);
      expect(clozes.length).toBe(notas.filter((n) => n.tipo === 'cloze').length);
      let linhasEmCardsDeClozes = 0;
      let indicesDistintosTotal = 0;
      for (const linha of clozes) {
        const [texto, extra] = linha.flds.split('\x1f');
        expect(texto).toMatch(regex);
        expect(extra).toBe('');
        const distintos = indicesDistintos(texto);
        const ords = (cardsPorNota.get(linha.id) ?? []).sort((a, b) => a - b);
        expect(ords).toEqual(distintos.map((i) => i - 1));
        expect(new Set(ords).size).toBe(ords.length);
        linhasEmCardsDeClozes += ords.length;
        indicesDistintosTotal += distintos.length;
      }
      expect(linhasEmCardsDeClozes).toBe(indicesDistintosTotal);
    });

    it('toda nota básica tem mid = MODEL_ID_BASICO e exatamente 1 card de ord 0', () => {
      const cardsPorNota = new Map<number, number[]>();
      for (const card of colecao.cards) cardsPorNota.set(card.nid, [...(cardsPorNota.get(card.nid) ?? []), card.ord]);
      const basicas = colecao.notas.filter((n) => n.mid === MODEL_ID_BASICO);
      expect(basicas.length).toBe(notas.filter((n) => n.tipo === 'basico').length);
      for (const linha of basicas) expect(cardsPorNota.get(linha.id)).toEqual([0]);
    });
  });

  // ─────────── itens 3, 4 e 6: Anki headless de verdade, uma coleção NOVA por teste ───────────

  describe('importação no Anki real (importar_apkg.py)', () => {
    async function importarNovo(arquivoApkg: Buffer = apkg): Promise<{ colecao: string; resultado: ResultadoImportacao }> {
      const colecao = await area.colecaoNova();
      const resultado = await importarApkg(await area.gravar('pacote.apkg', arquivoApkg), colecao);
      return { colecao, resultado };
    }

    async function reimportar(colecao: string, arquivoApkg: Buffer): Promise<ResultadoImportacao> {
      return importarApkg(await area.gravar('pacote.apkg', arquivoApkg), colecao);
    }

    function exigirSemProblemas(resultado: ResultadoImportacao): void {
      expect(resultado.erros).toEqual([]);
      expect(resultado.ok).toBe(true);
      expect(resultado.avisos).toEqual([]);
      expect(resultado.log_importacao).toMatchObject({
        conflicting: 0,
        missing_notetype: 0,
        missing_deck: 0,
        empty_first_field: 0,
        first_field_match: 0,
      });
    }

    function notaNoAnki(resultado: ResultadoImportacao, nota: NotaExportavel) {
      const encontrada = resultado.detalhe_notas.find((n) => n.guid === guidDoCard(nota.id));
      if (!encontrada) throw new Error(`nota ${nota.id} (guid ${guidDoCard(nota.id)}) não está na coleção do Anki`);
      return encontrada;
    }

    it('importa sem erro nem aviso, com as mesmas notas, cards, note types, guids e decks do pacote', async () => {
      const { resultado } = await importarNovo();
      exigirSemProblemas(resultado);
      expect(resultado.antes).toMatchObject({ notas: 0, cards: 0 });
      expect(resultado.log_importacao).toMatchObject({ new: notas.length, updated: 0, duplicate: 0 });
      expect(resultado.notas).toBe(notas.length);
      expect(resultado.cards).toBe(totalDeCards(notas));

      expect(resultado.notas_por_note_type).toEqual(contagemPorNoteType(notas));
      for (const tipo of resultado.notas_por_note_type) expect(tipo.nome).not.toContain('+');
      expect(ordenadas(resultado.guids)).toEqual(ordenadas(notas.map((n) => guidDoCard(n.id))));
      expect(resultado.baralhos.filter((d) => d !== 'Default')).toEqual(decksEsperados(pacote));
    });

    it('cada nota chega ao Anki com note type, campos, tags, deck e ords corretos', async () => {
      const { resultado } = await importarNovo();
      for (const nota of notas) {
        const noAnki = notaNoAnki(resultado, nota);
        expect(noAnki.modelo).toBe(nomeNoteTypeEsperado(nota));
        expect(noAnki.tipo).toBe(nota.tipo);
        expect(noAnki.mid).not.toBe(0);
        expect(noAnki.campos).toEqual(camposEsperados(nota));
        expect(noAnki.tags).toContain(`cardify::fixture-${nome}`);
        expect(noAnki.baralhos).toEqual([deckEsperado(pacote, nota)]);
        const ords = nota.tipo === 'cloze' ? indicesDistintos(nota.textoCloze ?? '').map((i) => i - 1) : [0];
        expect(noAnki.ords).toEqual(ords);
        expect(noAnki.cards).toBe(ords.length);
      }
    });

    it('o banco que o Anki grava tem sfld/csum pela regra do Anki e, sem quebra de linha, iguais aos do empacotador', async () => {
      const { colecao } = await importarNovo();
      const noAnki = lerBanco(colecao);
      const doPacote = new Map((await lerColecaoDoApkg(apkg)).colecao.notas.map((n) => [n.guid, n]));
      const porGuid = new Map(notas.map((n) => [guidDoCard(n.id), n]));
      expect(noAnki.notas).toHaveLength(notas.length);
      for (const linha of noAnki.notas) {
        const nota = porGuid.get(linha.guid);
        const original = doPacote.get(linha.guid);
        expect(nota && original, `guid ${linha.guid} desconhecido`).toBeTruthy();
        if (!nota || !original) continue;
        expect(linha.sfld).toBe(sfldDoAnki(primeiroCampo(nota)));
        expect(linha.csum).toBe(csumCampo(linha.sfld));
        if (!temQuebraNoPrimeiroCampo(nota)) {
          expect(linha.sfld).toBe(original.sfld);
          expect(linha.csum).toBe(original.csum);
        }
        expect(linha.mod).toBe(emSegundos(ATUALIZADO_EM_BASE));
      }
    });

    it('reimportar o mesmo arquivo sobre a mesma coleção não aumenta notas nem cards', async () => {
      const { colecao, resultado: primeira } = await importarNovo();
      exigirSemProblemas(primeira);
      const segunda = await reimportar(colecao, apkg);
      exigirSemProblemas(segunda);
      expect(segunda.antes).toMatchObject({ notas: notas.length, cards: totalDeCards(notas) });
      expect(segunda.notas).toBe(notas.length);
      expect(segunda.cards).toBe(totalDeCards(notas));
      expect(segunda.log_importacao).toMatchObject({ new: 0, updated: 0, duplicate: notas.length });
      expect(segunda.guids).toEqual(primeira.guids);
      expect(segunda.detalhe_notas).toEqual(primeira.detalhe_notas);
      expect(segunda.baralhos).toEqual(primeira.baralhos);

      const terceira = await reimportar(colecao, apkg);
      expect(terceira.notas).toBe(notas.length);
      expect(terceira.log_importacao).toMatchObject({ new: 0, updated: 0 });
    });

    it('editar um card (mesmo UUID, atualizadoEm posterior), reexportar e reimportar atualiza a nota sem duplicar', async () => {
      const alvo = notas[0];
      expect(alvo.tipo).toBe('basico');
      const novaFrente = 'Complete (revisado & corrigido): "P < 120" mmHg\nsegunda linha';
      const editadas = notas.map((n) => (n === alvo ? { ...n, frente: novaFrente, atualizadoEm: ATUALIZADO_EM_POSTERIOR } : n));
      const reexportado = await empacotar(montarPacoteDoFixture(nome, editadas), RELOGIO_EXPORTACAO_2);

      const { colecao, resultado: primeira } = await importarNovo();
      const segunda = await reimportar(colecao, reexportado);

      exigirSemProblemas(segunda);
      expect(segunda.log_importacao).toMatchObject({ new: 0, updated: 1, duplicate: notas.length - 1 });
      expect(segunda.notas).toBe(notas.length);
      expect(segunda.cards).toBe(totalDeCards(notas));
      expect(segunda.guids).toEqual(primeira.guids);

      const atualizada = notaNoAnki(segunda, alvo);
      expect(atualizada.campos).toEqual([escaparHtml(novaFrente), escaparHtml(alvo.verso)]);
      expect(atualizada.campos[0]).toBe('Complete (revisado &amp; corrigido): "P &lt; 120" mmHg<br>segunda linha');
      expect(atualizada.baralhos).toEqual([deckEsperado(pacote, alvo)]);

      const demaisAntes = primeira.detalhe_notas.filter((n) => n.guid !== guidDoCard(alvo.id));
      const demaisDepois = segunda.detalhe_notas.filter((n) => n.guid !== guidDoCard(alvo.id));
      expect(demaisDepois).toEqual(demaisAntes);

      const noBanco = lerBanco(colecao).notas.find((n) => n.guid === guidDoCard(alvo.id));
      expect(noBanco?.sfld).toBe('Complete (revisado & corrigido): "P < 120" mmHgsegunda linha');
      expect(noBanco?.csum).toBe(csumCampo('Complete (revisado & corrigido): "P < 120" mmHgsegunda linha'));
      expect(noBanco?.mod).toBe(emSegundos(ATUALIZADO_EM_POSTERIOR));
    });

    it('editar um cloze para ganhar c2 atualiza a nota e gera o card novo (cards = índices distintos)', async () => {
      const alvo = notas.find((n) => n.tipo === 'cloze' && indicesDistintos(n.textoCloze ?? '').length === 1);
      if (!alvo) throw new Error('o fixture não tem cloze de índice único');
      const novoTexto = `${alvo.textoCloze} Também: {{c2::termo & "extra"}} fim.`;
      const editadas = notas.map((n) => (n === alvo ? { ...n, textoCloze: novoTexto, atualizadoEm: ATUALIZADO_EM_POSTERIOR } : n));
      const reexportado = await empacotar(montarPacoteDoFixture(nome, editadas), RELOGIO_EXPORTACAO_2);

      const { colecao } = await importarNovo();
      const segunda = await reimportar(colecao, reexportado);

      exigirSemProblemas(segunda);
      expect(segunda.log_importacao).toMatchObject({ new: 0, updated: 1 });
      expect(segunda.notas).toBe(notas.length);
      const atualizada = notaNoAnki(segunda, alvo);
      expect(atualizada.campos[0]).toBe(escaparHtml(novoTexto));
      expect(atualizada.ords).toEqual([0, 1]);
      expect(segunda.cards).toBe(totalDeCards(notas) + 1);
      const bancoAnki = lerBanco(colecao);
      const nid = bancoAnki.notas.find((n) => n.guid === guidDoCard(alvo.id))?.id;
      expect(bancoAnki.cards.filter((c) => c.nid === nid).map((c) => c.ord)).toEqual([0, 1]);
    });

    it('reexportar SEM editar (mesmo atualizadoEm, outro relógio) não atualiza nada: edições do Anki não são sobrescritas', async () => {
      const semEdicao = await empacotar(montarPacoteDoFixture(nome, montarNotasDoFixture(nome)), RELOGIO_EXPORTACAO_2);
      expect(semEdicao.equals(apkg)).toBe(false);
      const [antes, depois] = await Promise.all([lerColecaoDoApkg(apkg), lerColecaoDoApkg(semEdicao)]);
      expect(depois.colecao.notas.map((n) => [n.guid, n.mod, n.flds])).toEqual(antes.colecao.notas.map((n) => [n.guid, n.mod, n.flds]));

      const { colecao, resultado: primeira } = await importarNovo();
      const segunda = await reimportar(colecao, semEdicao);
      exigirSemProblemas(segunda);
      expect(segunda.log_importacao).toMatchObject({ new: 0, updated: 0, duplicate: notas.length });
      expect(segunda.detalhe_notas).toEqual(primeira.detalhe_notas);
    });

    it('um pacote ANTIGO (atualizadoEm anterior) também não sobrescreve a nota mais nova da coleção', async () => {
      const alvo = notas[0];
      const editadas = notas.map((n) => (n === alvo ? { ...n, frente: 'versão nova no Cardify', atualizadoEm: ATUALIZADO_EM_POSTERIOR } : n));
      const novo = await empacotar(montarPacoteDoFixture(nome, editadas), RELOGIO_EXPORTACAO_2);
      const { colecao } = await importarNovo(novo);
      const reimportadoAntigo = await reimportar(colecao, apkg);
      exigirSemProblemas(reimportadoAntigo);
      expect(reimportadoAntigo.log_importacao).toMatchObject({ new: 0, updated: 0 });
      expect(notaNoAnki(reimportadoAntigo, alvo).campos[0]).toBe('versão nova no Cardify');
    });

    it('regenerar um card (UUID novo para a mesma frente) cria nota nova (RFC §5.4), sem tocar nas demais', async () => {
      const alvo = notas[0];
      const regenerada: NotaExportavel = { ...alvo, id: uuidDeterministico('regenerada', 0) };
      expect(guidDoCard(regenerada.id)).not.toBe(guidDoCard(alvo.id));
      const reexportado = await empacotar(
        montarPacoteDoFixture(
          nome,
          notas.map((n) => (n === alvo ? regenerada : n)),
        ),
        RELOGIO_EXPORTACAO_2,
      );

      const { colecao, resultado: primeira } = await importarNovo();
      const segunda = await reimportar(colecao, reexportado);

      exigirSemProblemas(segunda);
      expect(segunda.log_importacao).toMatchObject({ new: 1, updated: 0, duplicate: notas.length - 1 });
      expect(segunda.notas).toBe(notas.length + 1);
      expect(segunda.cards).toBe(totalDeCards(notas) + 1);
      const antiga = notaNoAnki(segunda, alvo);
      const nova = notaNoAnki(segunda, regenerada);
      expect(nova.guid).not.toBe(antiga.guid);
      expect(nova.campos).toEqual(antiga.campos);
      const demais = (resultado: ResultadoImportacao) => resultado.detalhe_notas.filter((n) => n.guid !== guidDoCard(regenerada.id));
      expect(demais(segunda)).toEqual(primeira.detalhe_notas);
    });
  });

  // ─────────── CSV/TSV (T14) contra o importador de texto oficial do Anki ───────────

  describe.each<[string, ',' | '\t', string, string]>([
    ['CSV', ',', 'csv', 'COMMA'],
    ['TSV', '\t', 'tsv', 'TAB'],
  ])('%s no importador de texto do Anki', (_rotulo, separador, extensao, delimitador) => {
    let texto: string;

    beforeAll(() => {
      texto = exportarDelimitado(pacote, separador);
    });

    async function importarTexto(conteudo: string, colecao: string): Promise<ResultadoImportacao> {
      return importarCsv(await area.gravar(`notas.${extensao}`, conteudo), colecao);
    }

    function linhasDeDados(conteudo: string): string[] {
      return conteudo.split('\n').filter((linha) => linha !== '' && !linha.startsWith('#'));
    }

    it('o arquivo tem uma linha por nota (sem quebra de linha dentro de campo)', () => {
      expect(linhasDeDados(texto)).toHaveLength(notas.length);
    });

    // O importador lê os cabeçalhos #... como a GUI. O arquivo pede o note type pelo NOME na coluna 1, e
    // "Cardify Básico"/"Cardify Cloze" só existem numa coleção que já recebeu o .apkg.
    describe('cenário 1: coleção NOVA (sem o .apkg)', () => {
      it('REGISTRA o comportamento atual: o Anki lê os cabeçalhos, mas descarta as notas por "missing_notetype", sem erro', async () => {
        const colecao = await area.colecaoNova();
        const r = await importarTexto(texto, colecao);

        expect(r.ok).toBe(true);
        expect(r.erros).toEqual([]);
        expect(r.metadados).toMatchObject({
          delimitador,
          html: true,
          colunas: ['Note type', 'Deck', 'Front/Text', 'Back', 'Tags', 'GUID'],
          coluna_note_type: 1,
          coluna_baralho: 2,
          coluna_tags: 5,
          coluna_guid: 6,
        });
        expect(r.metadados?.note_type_global.id).toBe(0);
        expect(r.log_importacao).toMatchObject({ new: 0, updated: 0, duplicate: 0, missing_notetype: notas.length });
        expect(r.avisos).toEqual([`missing_notetype: ${notas.length} nota(s)`]);
        expect(r.notas).toBe(0);
        expect(r.cards).toBe(0);
        expect(r.notas_por_note_type).toEqual([]);
        expect(r.baralhos).toEqual(['Default']);
        const nomes = (r.note_types ?? []).map((t) => t.nome);
        expect(nomes).toEqual(['Basic', 'Basic (and reversed card)', 'Basic (optional reversed card)', 'Basic (type in the answer)', 'Cloze', 'Image Occlusion']);
        expect(nomes).not.toContain(NOTE_TYPE_NOME_BASICO);
        expect(nomes).not.toContain(NOTE_TYPE_NOME_CLOZE);
      });

      // Quando delimitado.ts passar a produzir um arquivo importável em coleção nova este teste passa a
      // falhar ("fails" invertido): é o sinal para remover o it.fails e o teste de comportamento atual acima.
      it.fails('DESEJADO: importar numa coleção nova cria todas as notas nos note types do Cardify', async () => {
        const colecao = await area.colecaoNova();
        const r = await importarTexto(texto, colecao);
        expect(r.log_importacao.missing_notetype).toBe(0);
        expect(r.notas).toBe(notas.length);
        expect(r.cards).toBe(totalDeCards(notas));
        expect(r.notas_por_note_type).toEqual(contagemPorNoteType(notas));
      });

      it('com os note types de fábrica no arquivo (Basic/Cloze + coluna GUID) a mesma coleção nova importa tudo — correção recomendada', async () => {
        const colecao = await area.colecaoNova();
        const r = await importarTexto(deCompatibilidade(texto), colecao);

        expect(r.erros).toEqual([]);
        expect(r.metadados).toMatchObject({ coluna_guid: 6 });
        expect(r.log_importacao).toMatchObject({ new: notas.length, updated: 0, duplicate: 0, missing_notetype: 0 });
        expect(r.avisos).toEqual([]);
        expect(r.notas).toBe(notas.length);
        expect(r.cards).toBe(totalDeCards(notas));
        const esperadas = contagemPorNoteType(notas).map((t) => ({ ...t, nome: t.tipo === 'cloze' ? 'Cloze' : 'Basic' }));
        expect(r.notas_por_note_type).toEqual(esperadas.sort((a, b) => a.nome.localeCompare(b.nome)));
        expect(ordenadas(r.guids)).toEqual(ordenadas(notas.map((n) => guidDoCard(n.id))));
        expect(r.baralhos.filter((d) => d !== 'Default')).toEqual(decksEsperados(pacote));
        for (const nota of notas) {
          const noAnki = r.detalhe_notas.find((n) => n.guid === guidDoCard(nota.id));
          expect(noAnki?.campos).toEqual(camposEsperados(nota));
          expect(noAnki?.baralhos).toEqual([deckEsperado(pacote, nota)]);
          expect(noAnki?.ords).toEqual(nota.tipo === 'cloze' ? indicesDistintos(nota.textoCloze ?? '').map((i) => i - 1) : [0]);
        }
      });

      it('na variante recomendada, reimportar não duplica e editar atualiza a nota pelo GUID', async () => {
        const colecao = await area.colecaoNova();
        const variante = deCompatibilidade(texto);
        const primeira = await importarTexto(variante, colecao);
        expect(primeira.log_importacao.new).toBe(notas.length);

        const igual = await importarTexto(variante, colecao);
        expect(igual.log_importacao).toMatchObject({ new: 0, updated: 0, duplicate: notas.length });
        expect(igual.notas).toBe(notas.length);

        const alvo = notas[0];
        const editadas = notas.map((n) => (n === alvo ? { ...n, frente: 'Frente editada & revisada' } : n));
        const editada = deCompatibilidade(exportarDelimitado(montarPacoteDoFixture(nome, editadas), separador));
        const depois = await importarTexto(editada, colecao);
        expect(depois.log_importacao).toMatchObject({ new: 0, updated: 1, duplicate: notas.length - 1 });
        expect(depois.notas).toBe(notas.length);
        expect(depois.cards).toBe(totalDeCards(notas));
        expect(depois.detalhe_notas.find((n) => n.guid === guidDoCard(alvo.id))?.campos[0]).toBe('Frente editada &amp; revisada');
      });
    });

    describe('cenário 2: coleção onde o .apkg já foi importado', () => {
      it('casa todas as linhas com as notas existentes (primeiro campo + note type): 0 novas, N duplicadas, nada muda', async () => {
        const colecao = await area.colecaoNova();
        const doApkg = await importarApkg(await area.gravar('pacote.apkg', apkg), colecao);
        expect(doApkg.notas).toBe(notas.length);

        const r = await importarTexto(texto, colecao);

        expect(r.ok).toBe(true);
        expect(r.erros).toEqual([]);
        expect(r.avisos).toEqual([]);
        expect(r.metadados).toMatchObject({ delimitador, coluna_note_type: 1, coluna_baralho: 2, coluna_tags: 5 });
        expect(r.log_importacao).toMatchObject({ new: 0, updated: 0, duplicate: notas.length, missing_notetype: 0, missing_deck: 0 });
        expect(r.notas).toBe(notas.length);
        expect(r.cards).toBe(totalDeCards(notas));
        expect(r.notas_por_note_type).toEqual(contagemPorNoteType(notas));
        const nomes = (r.note_types ?? []).map((t) => t.nome);
        expect(nomes).toContain(NOTE_TYPE_NOME_BASICO);
        expect(nomes).toContain(NOTE_TYPE_NOME_CLOZE);
        expect(nomes.filter((n) => n.includes('+'))).toEqual([]);
        expect(r.baralhos).toEqual(doApkg.baralhos);
        expect(r.detalhe_notas).toEqual(doApkg.detalhe_notas);
      });

      it('uma linha com a frente editada atualiza a nota existente pelo GUID', async () => {
        const colecao = await area.colecaoNova();
        await importarApkg(await area.gravar('pacote.apkg', apkg), colecao);
        const alvo = notas[0];
        const editadas = notas.map((n) => (n === alvo ? { ...n, frente: 'Frente nova do CSV' } : n));
        const r = await importarTexto(exportarDelimitado(montarPacoteDoFixture(nome, editadas), separador), colecao);
        expect(r.log_importacao).toMatchObject({ new: 0, updated: 1, duplicate: notas.length - 1 });
        expect(r.notas).toBe(notas.length);
      });
    });
  });
});

/**
 * Variante com os note types de fábrica (`Basic`/`Cloze`, que existem em coleções criadas em inglês) na coluna 1,
 * mantendo a coluna GUID: mostra que o arquivo importa numa coleção nova quando o note type existe.
 */
function deCompatibilidade(texto: string): string {
  return texto
    .split('\n')
    .map((linha) => (linha.startsWith('#') ? linha : linha.replace(/^Cardify Básico(?=[,\t])/, 'Basic').replace(/^Cardify Cloze(?=[,\t])/, 'Cloze')))
    .join('\n');
}
