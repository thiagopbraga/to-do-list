import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CLOZE_REGEX,
  MODEL_ID_BASICO,
  MODEL_ID_CLOZE,
  NOTE_TYPE_NOME_BASICO,
  NOTE_TYPE_NOME_CLOZE,
  type NotaExportavel,
  type PacoteBaralho,
} from '@cardify/shared';
import Database from 'better-sqlite3';
import { ALFABETO_BASE91, base91 } from './base91';
import { AnkiApkgPacker, csumCampo, guidDoCard } from './packer';
import { nomeDeckDaNota } from './tags';
import { lerZip } from './zip';

const T0 = new Date('2026-05-01T12:00:00.000Z');

interface NotaDb {
  id: number;
  guid: string;
  mid: number;
  mod: number;
  usn: number;
  tags: string;
  flds: string;
  sfld: string;
  csum: number;
  flags: number;
  data: string;
}
interface CardDb {
  id: number;
  nid: number;
  did: number;
  ord: number;
  mod: number;
  usn: number;
  type: number;
  queue: number;
  due: number;
  [coluna: string]: number;
}
interface ModeloJson {
  id: number;
  name: string;
  type: number;
  tmpls: Array<Record<string, unknown> & { qfmt: string; afmt: string }>;
  flds: Array<Record<string, unknown> & { name: string }>;
  [chave: string]: unknown;
}

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

interface Colecao {
  arquivos: Map<string, Buffer>;
  notas: NotaDb[];
  cards: CardDb[];
  models: Record<string, ModeloJson>;
  decks: Record<string, { id: number; name: string; usn: number }>;
  conf: Record<string, unknown>;
  col: { mod: number; ver: number };
  tipos: { id: string; nota: string; card: string };
}

async function abrir(apkg: Buffer): Promise<Colecao> {
  const arquivos = await lerZip(apkg);
  const dir = mkdtempSync(path.join(tmpdir(), 'cardify-apkg-test-'));
  dirs.push(dir);
  const arquivo = path.join(dir, 'collection.anki2');
  writeFileSync(arquivo, arquivos.get('collection.anki2') ?? Buffer.alloc(0));
  const db = new Database(arquivo, { readonly: true });
  try {
    const col = db.prepare('SELECT * FROM col').get() as Record<string, string | number>;
    return {
      arquivos,
      notas: db.prepare('SELECT * FROM notes ORDER BY id').all() as NotaDb[],
      cards: db.prepare('SELECT * FROM cards ORDER BY id').all() as CardDb[],
      models: JSON.parse(col.models as string),
      decks: JSON.parse(col.decks as string),
      conf: JSON.parse(col.conf as string),
      col: { mod: col.mod as number, ver: col.ver as number },
      tipos: db.prepare('SELECT typeof(id) AS id, typeof(guid) AS nota, typeof(sfld) AS card FROM notes LIMIT 1').get() as Colecao['tipos'],
    };
  } finally {
    db.close();
  }
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function nota(n: number, extra: Partial<NotaExportavel>): NotaExportavel {
  return {
    id: uuid(n),
    tipo: 'basico',
    frente: `frente ${n}`,
    verso: `verso ${n}`,
    textoCloze: null,
    trilhaTitulos: [],
    tags: [],
    ordem: n,
    ...extra,
  };
}

function pacoteDeTeste(): PacoteBaralho {
  return {
    nomeBaralho: 'Fisiologia 2026',
    slugDocumento: 'fisiologia-2026',
    notas: [
      nota(1, { frente: 'O que é <b>sístole</b> & diástole?', verso: 'Contração "ventricular"\nseguida de relaxamento' }),
      nota(2, { tipo: 'cloze', frente: '', verso: '', textoCloze: 'O {{c1::coração}} bombeia o sangue.', trilhaTitulos: ['Cardio'] }),
      nota(3, {
        tipo: 'cloze',
        textoCloze: 'A {{c1::sístole}} ejeta sangue e a {{c2::diástole}} enche o ventrículo.',
        trilhaTitulos: ['Cardio', 'Ciclo cardíaco'],
        tags: ['revisar depois', 'prova'],
      }),
      nota(4, {
        tipo: 'cloze',
        textoCloze: '{{c1::Átrio}} direito recebe sangue venoso; {{c1::átrio}} esquerdo recebe arterial.',
        trilhaTitulos: ['Cardio', 'Ciclo cardíaco', 'Fases'],
      }),
      nota(5, { trilhaTitulos: ['Cardio', 'Ciclo cardíaco', 'Fases', 'Sístole isovolumétrica'], tags: ['Prova'] }),
      nota(6, { tipo: 'cloze', textoCloze: 'Se x < y & y > z então {{c2::x < z::hint}}\ne {{c1::fim}}.', trilhaTitulos: ['Resp'] }),
      nota(7, { frente: 'Pergunta com 5 < 6 e "aspas"', verso: 'a & b\r\nc', trilhaTitulos: ['Resp', 'Alvéolos'] }),
      nota(8, { tipo: 'cloze', textoCloze: '{{c1::a}} {{c2::b}} {{c3::c}} {{c3::d}}', trilhaTitulos: ['Cardio'] }),
      nota(9, { frente: '12345', verso: 'número no primeiro campo' }),
      nota(10, { tipo: 'cloze', textoCloze: '{{c2::Só c2}} existe aqui', trilhaTitulos: ['Resp', 'Alvéolos'] }),
    ],
  };
}

function indicesDistintos(texto: string): number[] {
  const indices = new Set([...texto.matchAll(new RegExp(CLOZE_REGEX.source, 'g'))].map((m) => Number(m[1])));
  return [...indices].sort((a, b) => a - b);
}

const sha1 = (texto: string): string => createHash('sha1').update(texto, 'utf8').digest('hex');

describe('base91', () => {
  it('usa o alfabeto de 91 caracteres do Anki', () => {
    expect(ALFABETO_BASE91).toHaveLength(91);
    expect(new Set(ALFABETO_BASE91).size).toBe(91);
  });

  it('converte como o guid do Anki (0, 90, 91 e o maior u64)', () => {
    expect(base91(0n)).toBe('a');
    expect(base91(90n)).toBe('~');
    expect(base91(91n)).toBe('ba');
    expect(base91(2n ** 64n - 1n)).toBe('Rj&Z5m[>Zp');
    expect(base91(0x0123456789abcdefn)).toBe('rNV`.x:p~');
  });
});

describe('guidDoCard / csumCampo', () => {
  it('é determinístico, tem no máximo 10 caracteres e só usa o alfabeto', () => {
    for (let i = 0; i < 200; i++) {
      const id = randomUUID();
      const guid = guidDoCard(id);
      expect(guid).toBe(guidDoCard(id));
      expect(guid.length).toBeGreaterThan(0);
      expect(guid.length).toBeLessThanOrEqual(10);
      expect([...guid].every((c) => ALFABETO_BASE91.includes(c))).toBe(true);
    }
    expect(guidDoCard(uuid(1))).not.toBe(guidDoCard(uuid(2)));
  });

  it('é base91 dos 8 primeiros bytes do sha1 do uuid', () => {
    const bytes = createHash('sha1').update(uuid(1)).digest().subarray(0, 8);
    expect(guidDoCard(uuid(1))).toBe(base91(BigInt(`0x${bytes.toString('hex')}`)));
  });

  it('csum é o inteiro dos 8 primeiros hex do sha1', () => {
    expect(csumCampo('abc')).toBe(parseInt(sha1('abc').slice(0, 8), 16));
    expect(csumCampo('abc')).toBe(0xa9993e36);
  });
});

describe('AnkiApkgPacker', () => {
  const pacote = pacoteDeTeste();
  const notasOrdenadas = [...pacote.notas].sort((a, b) => a.ordem - b.ordem);
  let apkg: Buffer;
  let colecao: Colecao;

  beforeAll(async () => {
    apkg = await new AnkiApkgPacker({ agora: () => T0 }).empacotar(pacote);
    colecao = await abrir(apkg);
  });

  it('gera zip com collection.anki2 e media vazio', () => {
    expect([...colecao.arquivos.keys()].sort()).toEqual(['collection.anki2', 'media']);
    expect(colecao.arquivos.get('media')?.toString()).toBe('{}');
    expect(colecao.col.ver).toBe(11);
  });

  it('conta notas e cards: 1 por básica, índices distintos por cloze', () => {
    const esperadosCards = notasOrdenadas.reduce(
      (soma, n) => soma + (n.tipo === 'cloze' ? indicesDistintos(n.textoCloze ?? '').length : 1),
      0,
    );
    expect(colecao.notas).toHaveLength(pacote.notas.length);
    expect(colecao.cards).toHaveLength(esperadosCards);
    expect(esperadosCards).toBe(1 + 1 + 2 + 1 + 1 + 2 + 1 + 3 + 1 + 1);
  });

  it('cada nota tem o note type certo e os cards com ord correto', () => {
    notasOrdenadas.forEach((original, i) => {
      const linha = colecao.notas[i];
      const cards = colecao.cards.filter((c) => c.nid === linha.id).sort((a, b) => a.ord - b.ord);
      if (original.tipo === 'cloze') {
        expect(linha.mid).toBe(MODEL_ID_CLOZE);
        const [texto, extra] = linha.flds.split('\x1f');
        expect(extra).toBe('');
        expect(texto).toMatch(new RegExp(CLOZE_REGEX.source));
        expect(cards.map((c) => c.ord)).toEqual(indicesDistintos(texto).map((x) => x - 1));
      } else {
        expect(linha.mid).toBe(MODEL_ID_BASICO);
        expect(linha.flds.split('\x1f')).toHaveLength(2);
        expect(cards.map((c) => c.ord)).toEqual([0]);
      }
    });
  });

  it('aplica o mesmo escape do CSV e preserva as marcações cloze', () => {
    const [n1, , , , , n6, n7] = colecao.notas;
    expect(n1.flds).toBe(
      'O que é &lt;b&gt;sístole&lt;/b&gt; &amp; diástole?\x1fContração "ventricular"<br>seguida de relaxamento',
    );
    expect(n6.flds).toBe('Se x &lt; y &amp; y &gt; z então {{c2::x &lt; z::hint}}<br>e {{c1::fim}}.\x1f');
    expect(n7.flds).toBe('Pergunta com 5 &lt; 6 e "aspas"\x1fa &amp; b<br>c');
  });

  it('sfld é o primeiro campo sem HTML e csum bate com sha1', () => {
    for (const linha of colecao.notas) {
      const primeiro = linha.flds.split('\x1f')[0];
      const puro = primeiro
        .replace(/<br>/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      expect(String(linha.sfld)).toBe(puro);
      expect(String(linha.sfld)).not.toMatch(/<br>|&amp;|&lt;|&gt;/);
      expect(linha.csum).toBe(parseInt(sha1(puro).slice(0, 8), 16));
    }
    expect(colecao.notas[0].sfld).toBe('O que é <b>sístole</b> & diástole?');
  });

  it('grava campos fixos: usn -1, flags 0, data vazio, mod em segundos', () => {
    const segundos = Math.floor(T0.getTime() / 1000);
    for (const linha of colecao.notas) {
      expect(linha.usn).toBe(-1);
      expect(linha.flags).toBe(0);
      expect(linha.data).toBe('');
      expect(linha.mod).toBe(segundos);
    }
    expect(colecao.col.mod).toBe(T0.getTime());
  });

  it('usa inteiros do SQLite nos ids', () => {
    expect(colecao.tipos.id).toBe('integer');
    expect(colecao.tipos.nota).toBe('text');
  });

  it('cards nascem como novos, ordenados por posição, com mod em segundos e usn -1', () => {
    const segundos = Math.floor(T0.getTime() / 1000);
    const posicoes = new Map(colecao.notas.map((n, i) => [n.id, i + 1]));
    for (const card of colecao.cards) {
      expect(card).toMatchObject({
        usn: -1, type: 0, queue: 0, ivl: 0, factor: 0, reps: 0, lapses: 0, left: 0, odue: 0, odid: 0, flags: 0, data: '', mod: segundos,
      });
      expect(card.due).toBe(posicoes.get(card.nid));
    }
  });

  it('tags no formato do Anki, com espaços nas pontas', () => {
    expect(colecao.notas[0].tags).toBe(' cardify::fisiologia-2026 ');
    expect(colecao.notas[2].tags).toBe(
      ' cardify::fisiologia-2026 cardify::fisiologia-2026::ciclo-cardiaco revisar_depois prova ',
    );
    for (const linha of colecao.notas) expect(linha.tags).toMatch(/^ \S+( \S+)* $/);
  });

  it('col.models tem exatamente os 2 note types fixos, sem id em templates/campos', () => {
    expect(Object.keys(colecao.models).sort()).toEqual([String(MODEL_ID_BASICO), String(MODEL_ID_CLOZE)].sort());
    const basico = colecao.models[String(MODEL_ID_BASICO)];
    const cloze = colecao.models[String(MODEL_ID_CLOZE)];
    expect(basico).toMatchObject({ id: MODEL_ID_BASICO, name: NOTE_TYPE_NOME_BASICO, type: 0, sortf: 0 });
    expect(cloze).toMatchObject({ id: MODEL_ID_CLOZE, name: NOTE_TYPE_NOME_CLOZE, type: 1, sortf: 0 });
    expect(basico.flds.map((f) => f.name)).toEqual(['Frente', 'Verso']);
    expect(cloze.flds.map((f) => f.name)).toEqual(['Texto', 'Extra']);
    expect(basico.tmpls).toHaveLength(1);
    expect(basico.tmpls[0]).toMatchObject({ name: 'Cartão 1', qfmt: '{{Frente}}', afmt: '{{FrontSide}}<hr id=answer>{{Verso}}' });
    expect(cloze.tmpls).toHaveLength(1);
    expect(cloze.tmpls[0].qfmt).toContain('{{cloze:Texto}}');
    expect(cloze.tmpls[0].afmt).toContain('{{cloze:Texto}}');
    for (const modelo of [basico, cloze]) {
      for (const parte of [...modelo.tmpls, ...modelo.flds]) expect(parte).not.toHaveProperty('id');
      for (const chave of ['css', 'latexPre', 'latexPost', 'latexsvg', 'req', 'mod', 'usn', 'did']) expect(modelo).toHaveProperty(chave);
    }
  });

  it('col.decks tem raiz e todos os subdecks (máx. 3 níveis) e cards.did aponta para o certo', () => {
    const porNome = new Map(Object.values(colecao.decks).map((d) => [d.name, d]));
    const esperados = [
      'Default',
      'Fisiologia 2026',
      'Fisiologia 2026::Cardio',
      'Fisiologia 2026::Cardio::Ciclo cardíaco',
      'Fisiologia 2026::Cardio::Ciclo cardíaco::Fases',
      'Fisiologia 2026::Resp',
      'Fisiologia 2026::Resp::Alvéolos',
    ];
    expect([...porNome.keys()].sort()).toEqual([...esperados].sort());
    for (const [chave, deck] of Object.entries(colecao.decks)) {
      expect(Number(chave)).toBe(deck.id);
      expect(deck.name.split('::').length).toBeLessThanOrEqual(4);
      if (deck.name !== 'Default') expect(deck.usn).toBe(-1);
    }
    expect(porNome.get('Default')?.id).toBe(1);
    expect(colecao.conf.curDeck).toBe(porNome.get('Fisiologia 2026')?.id);
    expect(colecao.conf.activeDecks).toEqual([porNome.get('Fisiologia 2026')?.id]);

    notasOrdenadas.forEach((original, i) => {
      const nomeDeck = nomeDeckDaNota(pacote.nomeBaralho, original.trilhaTitulos);
      for (const card of colecao.cards.filter((c) => c.nid === colecao.notas[i].id)) {
        expect(card.did).toBe(porNome.get(nomeDeck)?.id);
      }
    });
  });

  it('é determinístico: mesmos guids e deck ids em duas exportações; cards.did iguais', async () => {
    const outra = await abrir(await new AnkiApkgPacker({ agora: () => new Date(T0.getTime() + 60_000) }).empacotar(pacote));
    expect(outra.notas.map((n) => n.guid)).toEqual(colecao.notas.map((n) => n.guid));
    expect(Object.keys(outra.decks).sort()).toEqual(Object.keys(colecao.decks).sort());
    expect(outra.cards.map((c) => c.did)).toEqual(colecao.cards.map((c) => c.did));
    expect(outra.models).toEqual(colecao.models);
    expect(outra.notas.every((n, i) => n.mod > colecao.notas[i].mod)).toBe(true);
  });

  it('guid é estável após editar frente/verso e muda com outro uuid', async () => {
    const editado: PacoteBaralho = {
      ...pacote,
      notas: pacote.notas.map((n, i) =>
        i === 0
          ? { ...n, frente: 'frente editada', verso: 'verso editado' }
          : i === 1
            ? { ...n, id: randomUUID() }
            : n,
      ),
    };
    const outra = await abrir(await new AnkiApkgPacker({ agora: () => T0 }).empacotar(editado));
    expect(outra.notas[0].guid).toBe(colecao.notas[0].guid);
    expect(outra.notas[0].flds).not.toBe(colecao.notas[0].flds);
    expect(outra.notas[1].guid).not.toBe(colecao.notas[1].guid);
    expect(outra.notas.slice(2).map((n) => n.guid)).toEqual(colecao.notas.slice(2).map((n) => n.guid));
    expect(new Set(colecao.notas.map((n) => n.guid)).size).toBe(colecao.notas.length);
  });

  it('ids de notas e cards são únicos mesmo com 500 notas no mesmo instante', async () => {
    const muitas: PacoteBaralho = {
      nomeBaralho: 'Grande',
      slugDocumento: 'grande',
      notas: Array.from({ length: 500 }, (_, i) =>
        i % 2 === 0
          ? nota(i, { id: randomUUID(), ordem: i })
          : nota(i, { id: randomUUID(), ordem: i, tipo: 'cloze', textoCloze: `{{c1::a${i}}} e {{c2::b}}` }),
      ),
    };
    const grande = await abrir(await new AnkiApkgPacker({ agora: () => T0 }).empacotar(muitas));
    expect(grande.notas).toHaveLength(500);
    expect(grande.cards).toHaveLength(250 + 250 * 2);
    expect(new Set(grande.notas.map((n) => n.id)).size).toBe(500);
    expect(new Set(grande.cards.map((c) => c.id)).size).toBe(grande.cards.length);
    expect(new Set(grande.notas.map((n) => n.guid)).size).toBe(500);
  });

  it('ordena as notas por `ordem`, não pela ordem do array', async () => {
    const invertido: PacoteBaralho = { ...pacote, notas: [...pacote.notas].reverse() };
    const outra = await abrir(await new AnkiApkgPacker({ agora: () => T0 }).empacotar(invertido));
    expect(outra.notas.map((n) => n.guid)).toEqual(colecao.notas.map((n) => n.guid));
  });

  it('cloze sem oclusão ou sem texto é erro (nunca vira básico)', async () => {
    const packer = new AnkiApkgPacker({ agora: () => T0 });
    const base = (extra: Partial<NotaExportavel>): PacoteBaralho => ({
      nomeBaralho: 'X',
      slugDocumento: 'x',
      notas: [nota(1, { tipo: 'cloze', ...extra })],
    });
    await expect(packer.empacotar(base({ textoCloze: 'texto sem oclusão' }))).rejects.toThrow(/oclusão/);
    await expect(packer.empacotar(base({ textoCloze: null }))).rejects.toThrow(/textoCloze/);
    await expect(packer.empacotar(base({ textoCloze: '   ' }))).rejects.toThrow(/textoCloze/);
    await expect(packer.empacotar(base({ textoCloze: '{{c0::zero}}' }))).rejects.toThrow(/c0/);
  });

  it('aceita pacote sem notas (só os decks e note types)', async () => {
    const vazio = await abrir(await new AnkiApkgPacker({ agora: () => T0 }).empacotar({ nomeBaralho: 'Vazio', slugDocumento: 'v', notas: [] }));
    expect(vazio.notas).toHaveLength(0);
    expect(Object.values(vazio.decks).map((d) => d.name).sort()).toEqual(['Default', 'Vazio']);
  });

  it('aceita o caminho da semente como string (compatibilidade com o stub)', async () => {
    const packer = new AnkiApkgPacker(new AnkiApkgPacker().caminhoSeed);
    const colecaoString = await abrir(await packer.empacotar(pacote));
    expect(colecaoString.notas).toHaveLength(pacote.notas.length);
  });
});

describe('mod da nota', () => {
  it('usa atualizadoEm quando informado e o relógio da exportação quando não', async () => {
    const editadoEm = new Date('2026-10-01T10:00:00Z');
    const exportadoEm = new Date('2026-10-03T10:00:00Z');
    const packer = new AnkiApkgPacker({ agora: () => exportadoEm });
    const apkg = await packer.empacotar({
      nomeBaralho: 'Fisiologia',
      slugDocumento: 'fisiologia',
      notas: [
        nota(1, { tipo: 'basico', frente: 'Frente um', verso: 'Verso um', ordem: 0, atualizadoEm: editadoEm }),
        nota(2, { tipo: 'basico', frente: 'Frente dois', verso: 'Verso dois', ordem: 1 }),
      ],
    });
    const { notas } = await abrir(apkg);
    const porGuid = new Map(notas.map((n) => [n.guid, n.mod]));
    expect(porGuid.get(guidDoCard(uuid(1)))).toBe(Math.floor(editadoEm.getTime() / 1000));
    expect(porGuid.get(guidDoCard(uuid(2)))).toBe(Math.floor(exportadoEm.getTime() / 1000));
  });
});
