import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RAIZ_CARDIFY } from './fixtures';

const TIMEOUT_PYTHON_MS = 120_000;
const MAX_BUFFER = 64 * 1024 * 1024;

export interface LogImportacao {
  new: number;
  updated: number;
  duplicate: number;
  conflicting: number;
  missing_notetype: number;
  missing_deck: number;
  empty_first_field: number;
  first_field_match: number;
}

export interface NotaNoAnki {
  guid: string;
  modelo: string;
  tipo: 'basico' | 'cloze';
  mid: number;
  campos: string[];
  tags: string[];
  cards: number;
  ords: number[];
  baralhos: string[];
}

export interface ResultadoImportacao {
  ok: boolean;
  erros: string[];
  avisos: string[];
  antes: { notas: number; cards: number; note_types?: string[] };
  log_importacao: LogImportacao;
  notas: number;
  cards: number;
  notas_por_note_type: Array<{ nome: string; tipo: 'basico' | 'cloze'; notas: number }>;
  guids: string[];
  detalhe_notas: NotaNoAnki[];
  baralhos: string[];
  metadados?: {
    delimitador: string;
    html: boolean;
    colunas: string[];
    coluna_note_type: number;
    coluna_baralho: number;
    coluna_tags: number;
    coluna_guid: number;
    note_type_global: { id: number; nome: string | null };
    duplicatas: string;
  };
  note_types?: Array<{ nome: string; tipo: 'basico' | 'cloze'; campos: string[] }>;
}

export interface SaidaPython {
  codigo: number;
  stdout: string;
  stderr: string;
}

/** `CARDIFY_ANKI_PYTHON` existe só para a própria suíte provar a mensagem de pré-condição. */
export function caminhoPython(): string {
  return process.env.CARDIFY_ANKI_PYTHON ?? path.join(RAIZ_CARDIFY, 'tools/anki/.venv/bin/python');
}

function executar(args: string[]): Promise<SaidaPython> {
  return new Promise((resolve, reject) => {
    execFile(
      caminhoPython(),
      ['-I', ...args],
      { timeout: TIMEOUT_PYTHON_MS, maxBuffer: MAX_BUFFER, encoding: 'utf8', cwd: RAIZ_CARDIFY },
      (erro, stdout, stderr) => {
        if (!erro) return resolve({ codigo: 0, stdout, stderr });
        const codigo = (erro as NodeJS.ErrnoException & { code?: unknown }).code;
        // Código de saída != 0 é resposta legítima dos scripts (2 = importador falhou): quem chama decide.
        if (typeof codigo === 'number' && !erro.killed) return resolve({ codigo, stdout, stderr });
        reject(new Error(`falha ao executar ${args.join(' ')}: ${erro.message}\n${stderr}`));
      },
    );
  });
}

/** Falha (nunca pula) quando o ambiente Python do Anki não foi preparado. */
export async function exigirAmbienteAnki(): Promise<void> {
  const python = caminhoPython();
  if (!existsSync(python)) {
    throw new Error(
      `Ambiente Python do Anki ausente: ${python} não existe. ` +
        'Rode "bash tools/anki/preparar.sh" (a partir de cardify/) e repita. ' +
        'Esta suíte é o gate da RFC-001 §9 e não pode ser pulada.',
    );
  }
  const saida = await executar(['-c', 'import anki.buildinfo as b; print(b.version)']);
  if (saida.codigo !== 0) {
    throw new Error(
      `A biblioteca "anki" não está instalada em ${python}. Rode "bash tools/anki/preparar.sh" e repita.\n${saida.stderr}`,
    );
  }
}

async function rodarImportador(script: string, arquivo: string, colecao: string): Promise<ResultadoImportacao> {
  const saida = await executar([path.join(RAIZ_CARDIFY, 'tools/anki', script), arquivo, '--colecao', colecao, '--json']);
  let resultado: ResultadoImportacao;
  try {
    resultado = JSON.parse(saida.stdout) as ResultadoImportacao;
  } catch {
    throw new Error(`${script} não devolveu JSON (código ${saida.codigo}):\n${saida.stdout}\n${saida.stderr}`);
  }
  return resultado;
}

/** Importa o `.apkg` com o importador oficial do Anki (tools/anki/importar_apkg.py). */
export function importarApkg(arquivo: string, colecao: string): Promise<ResultadoImportacao> {
  return rodarImportador('importar_apkg.py', arquivo, colecao);
}

/** Importa o CSV/TSV com o importador de texto oficial do Anki (tools/anki/importar_csv.py). */
export function importarCsv(arquivo: string, colecao: string): Promise<ResultadoImportacao> {
  return rodarImportador('importar_csv.py', arquivo, colecao);
}

/** Diretório temporário da suíte: coleções, pacotes e CSVs. `limpar()` no `afterAll`. */
export class AreaTemporaria {
  private readonly diretorios: string[] = [];

  /** Caminho de uma coleção NOVA (o arquivo ainda não existe; o importador cria). */
  async colecaoNova(): Promise<string> {
    return path.join(await this.diretorio(), 'colecao.anki2');
  }

  async gravar(nome: string, conteudo: Buffer | string): Promise<string> {
    const arquivo = path.join(await this.diretorio(), nome);
    await writeFile(arquivo, conteudo);
    return arquivo;
  }

  async diretorio(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'cardify-apkg-int-'));
    this.diretorios.push(dir);
    return dir;
  }

  async limpar(): Promise<void> {
    await Promise.all(this.diretorios.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  }
}
