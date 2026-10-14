import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { lerZip } from '../zip';

export interface NotaDb {
  id: number;
  guid: string;
  mid: number;
  mod: number;
  tags: string;
  flds: string;
  sfld: string;
  csum: number;
}
export interface CardDb {
  id: number;
  nid: number;
  did: number;
  ord: number;
}
export interface ColecaoLida {
  notas: NotaDb[];
  cards: CardDb[];
  models: Record<string, { id: number; name: string; type: number }>;
  decks: Record<string, { id: number; name: string }>;
}

export function lerBanco(arquivo: string): ColecaoLida {
  const db = new Database(arquivo, { readonly: true });
  try {
    const col = db.prepare('SELECT models, decks FROM col').get() as { models: string; decks: string };
    return {
      notas: db.prepare('SELECT id, guid, mid, mod, tags, flds, sfld, csum FROM notes ORDER BY id').all() as NotaDb[],
      cards: db.prepare('SELECT id, nid, did, ord FROM cards ORDER BY id').all() as CardDb[],
      // No schema 18 (coleções gravadas pelo Anki atual) estas colunas são vazias: models/decks vivem em tabelas.
      models: (col.models ? JSON.parse(col.models) : {}) as ColecaoLida['models'],
      decks: (col.decks ? JSON.parse(col.decks) : {}) as ColecaoLida['decks'],
    };
  } finally {
    db.close();
  }
}

/** Abre o `collection.anki2` de dentro do `.apkg` (zip) com better-sqlite3. */
export async function lerColecaoDoApkg(apkg: Buffer): Promise<{ arquivos: Map<string, Buffer>; colecao: ColecaoLida }> {
  const arquivos = await lerZip(apkg);
  const banco = arquivos.get('collection.anki2');
  if (!banco) throw new Error('o .apkg não contém collection.anki2');
  const dir = await mkdtemp(path.join(tmpdir(), 'cardify-apkg-lido-'));
  try {
    const arquivo = path.join(dir, 'collection.anki2');
    await writeFile(arquivo, banco);
    return { arquivos, colecao: lerBanco(arquivo) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
