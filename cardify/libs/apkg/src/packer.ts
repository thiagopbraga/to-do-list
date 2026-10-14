import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CLOZE_REGEX,
  CardifyError,
  MODEL_ID_BASICO,
  MODEL_ID_CLOZE,
  type ApkgPacker,
  type NotaExportavel,
  type PacoteBaralho,
} from '@cardify/shared';
import type { Archiver, ArchiverOptions } from 'archiver' with { 'resolution-mode': 'import' };
import Database from 'better-sqlite3';
import { base91 } from './base91';
import { modelosJson } from './modelos';
import { nomeDeckDaNota, tagsDaNota } from './tags';

// O runtime instalado é o archiver 7 (CJS, função que cria o arquivo), mas @types/archiver 8 descreve o
// archiver 8 (ESM, classes). Tipamos aqui o contrato do 7 e usamos require para não depender do tipo ESM.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const criarArquivoZip = require('archiver') as (formato: 'zip', opcoes?: ArchiverOptions) => Archiver;

const SEPARADOR_CAMPOS = '\x1f';
const CAMINHO_SEED_PADRAO = path.resolve(__dirname, '../assets/collection.anki2');

/** GUID estável derivado do UUID do card: base91(sha1(id)[0..8]) (RFC §5.4). */
export function guidDoCard(cardId: string): string {
  const hash = createHash('sha1').update(cardId, 'utf8').digest();
  return base91(hash.readBigUInt64BE(0));
}

/** csum do Anki: parseInt(sha1(campoTextoPuro).slice(0, 8), 16). */
export function csumCampo(texto: string): number {
  return parseInt(createHash('sha1').update(texto, 'utf8').digest('hex').slice(0, 8), 16);
}

export interface OpcoesApkgPacker {
  caminhoSeed?: string;
  /** Relógio injetável para testes. */
  agora?: () => Date;
}

interface DeckJson {
  id: number;
  name: string;
  mod: number;
  usn: number;
  [chave: string]: unknown;
}

export class AnkiApkgPacker implements ApkgPacker {
  readonly caminhoSeed: string;
  private readonly agora: () => Date;

  constructor(opcoes: OpcoesApkgPacker | string = {}) {
    const { caminhoSeed, agora } = typeof opcoes === 'string' ? { caminhoSeed: opcoes, agora: undefined } : opcoes;
    this.caminhoSeed = caminhoSeed ?? CAMINHO_SEED_PADRAO;
    this.agora = agora ?? (() => new Date());
  }

  async empacotar(pacote: PacoteBaralho): Promise<Buffer> {
    const instante = this.agora().getTime();
    const notas = [...pacote.notas].sort((a, b) => a.ordem - b.ordem);
    // Valida tudo antes de tocar no disco: um cloze inválido não pode deixar temporário para trás.
    const prontas = notas.map((nota) => prepararNota(pacote, nota));

    const diretorio = await mkdtemp(path.join(tmpdir(), 'cardify-apkg-'));
    try {
      const arquivoColecao = path.join(diretorio, 'collection.anki2');
      await copyFile(this.caminhoSeed, arquivoColecao);
      gravarColecao(arquivoColecao, pacote, prontas, instante);
      return await zipar(await readFile(arquivoColecao), new Date(instante));
    } finally {
      await rm(diretorio, { recursive: true, force: true });
    }
  }
}

interface NotaPronta {
  nota: NotaExportavel;
  tipo: 'basico' | 'cloze';
  campos: string[];
  nomeDeck: string;
  tags: string[];
  indicesCloze: number[];
}

function prepararNota(pacote: PacoteBaralho, nota: NotaExportavel): NotaPronta {
  const nomeDeck = nomeDeckDaNota(pacote.nomeBaralho, nota.trilhaTitulos);
  const tags = tagsDaNota(pacote.slugDocumento, nota.trilhaTitulos, nota.tags);
  if (nota.tipo === 'cloze') {
    const indicesCloze = indicesDistintos(nota);
    return { nota, tipo: 'cloze', campos: [escaparHtml(nota.textoCloze ?? ''), ''], nomeDeck, tags, indicesCloze };
  }
  return {
    nota,
    tipo: 'basico',
    campos: [escaparHtml(nota.frente), escaparHtml(nota.verso)],
    nomeDeck,
    tags,
    indicesCloze: [],
  };
}

function indicesDistintos(nota: NotaExportavel): number[] {
  if (nota.textoCloze === null || nota.textoCloze.trim() === '') {
    throw new CardifyError('nota_cloze_sem_texto', `nota ${nota.id} é cloze sem textoCloze`);
  }
  const indices = new Set<number>();
  for (const ocorrencia of nota.textoCloze.matchAll(new RegExp(CLOZE_REGEX.source, 'g'))) {
    indices.add(Number(ocorrencia[1]));
  }
  if (indices.size === 0) {
    throw new CardifyError('nota_cloze_sem_oclusao', `nota ${nota.id} é cloze sem nenhuma oclusão {{cN::...}}`);
  }
  if (indices.has(0)) {
    throw new CardifyError('nota_cloze_indice_invalido', `nota ${nota.id} usa {{c0::...}}; índices começam em 1`);
  }
  return [...indices].sort((a, b) => a - b);
}

/** Mesma regra do CSV (delimitado.ts). As marcações `{{cN::...}}` não contêm `& < >`, então passam intactas. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?|\n/g, '<br>');
}

/** Texto puro de um campo já escapado: o que o Anki guarda em `sfld` e usa no `csum`. */
function textoPuro(campoHtml: string): string {
  return campoHtml
    .replace(/<br>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/** Ids em ms únicos dentro do arquivo: 100 notas no mesmo tick é o caso comum, não a exceção. */
function geradorDeIds(inicio: number): () => number {
  let ultimo = inicio - 1;
  return () => {
    ultimo += 1;
    return ultimo;
  };
}

/** Id determinístico por nome completo, para reexportações apontarem para os mesmos decks. */
function idDoDeck(nomeCompleto: string): number {
  const hash = createHash('sha1').update(nomeCompleto, 'utf8').digest();
  return 1_000_000_000_000 + (hash.readUIntBE(0, 6) % 1_000_000_000_000);
}

function gravarColecao(arquivo: string, pacote: PacoteBaralho, notas: NotaPronta[], instanteMs: number): void {
  const segundos = Math.floor(instanteMs / 1000);
  const db = new Database(arquivo);
  try {
    const linha = db.prepare('SELECT decks, conf FROM col').get() as { decks: string; conf: string } | undefined;
    if (!linha) throw new CardifyError('semente_invalida', 'a semente não tem a linha única de col');
    const decks = JSON.parse(linha.decks) as Record<string, DeckJson>;
    const conf = JSON.parse(linha.conf) as Record<string, unknown>;
    const modeloDeck = decks['1'];
    if (!modeloDeck) throw new CardifyError('semente_invalida', 'a semente não tem o deck Default (id 1)');

    const idsDeck = new Map<string, number>();
    for (const { nomeDeck } of notas) registrarDeck(nomeDeck);
    registrarDeck(nomeDeckDaNota(pacote.nomeBaralho, []));

    function registrarDeck(nomeCompleto: string): void {
      const partes = nomeCompleto.split('::');
      for (let i = 1; i <= partes.length; i++) {
        const nome = partes.slice(0, i).join('::');
        if (idsDeck.has(nome)) continue;
        const id = idDoDeck(nome);
        idsDeck.set(nome, id);
        decks[String(id)] = { ...modeloDeck, id, name: nome, mod: segundos, usn: -1, collapsed: false, browserCollapsed: false };
      }
    }

    const idRaiz = idsDeck.get(nomeDeckDaNota(pacote.nomeBaralho, []));
    if (idRaiz !== undefined) {
      if ('curDeck' in conf) conf.curDeck = idRaiz;
      if ('activeDecks' in conf) conf.activeDecks = [idRaiz];
    }

    const inserirNota = db.prepare(
      'INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, \'\')',
    );
    const inserirCard = db.prepare(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
       VALUES (?, ?, ?, ?, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
    );
    const proximoIdNota = geradorDeIds(instanteMs);
    const proximoIdCard = geradorDeIds(instanteMs);

    db.transaction(() => {
      db.prepare('UPDATE col SET mod = ?, models = ?, decks = ?, conf = ?').run(
        instanteMs,
        modelosJson(),
        JSON.stringify(decks),
        JSON.stringify(conf),
      );
      notas.forEach((pronta, posicao) => {
        const idNota = proximoIdNota();
        const primeiroCampo = textoPuro(pronta.campos[0]);
        inserirNota.run(
          idNota,
          guidDoCard(pronta.nota.id),
          pronta.tipo === 'cloze' ? MODEL_ID_CLOZE : MODEL_ID_BASICO,
          pronta.nota.atualizadoEm ? Math.floor(pronta.nota.atualizadoEm.getTime() / 1000) : segundos,
          ` ${pronta.tags.join(' ')} `,
          pronta.campos.join(SEPARADOR_CAMPOS),
          primeiroCampo,
          csumCampo(primeiroCampo),
        );
        const idDeck = idsDeck.get(pronta.nomeDeck);
        const ords = pronta.tipo === 'cloze' ? pronta.indicesCloze.map((indice) => indice - 1) : [0];
        for (const ord of ords) {
          inserirCard.run(proximoIdCard(), idNota, idDeck, ord, segundos, posicao + 1);
        }
      });
    })();
    db.pragma('journal_mode = DELETE');
  } finally {
    db.close();
  }
}

function zipar(colecao: Buffer, data: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const arquivo = criarArquivoZip('zip', { zlib: { level: 9 } });
    const partes: Buffer[] = [];
    arquivo.on('data', (parte: Buffer) => partes.push(parte));
    arquivo.on('error', reject);
    arquivo.on('end', () => resolve(Buffer.concat(partes)));
    arquivo.append(colecao, { name: 'collection.anki2', date: data });
    arquivo.append('{}', { name: 'media', date: data });
    void arquivo.finalize();
  });
}
