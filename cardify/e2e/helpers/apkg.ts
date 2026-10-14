import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { IMPORTADOR_ANKI, PYTHON_ANKI, RAIZ } from '../ambiente';

const executar = promisify(execFile);

export interface NotaImportada {
  guid: string;
  modelo: string;
  tipo: 'basico' | 'cloze';
  campos: string[];
  tags: string[];
  cards: number;
}

export interface ResultadoImportacao {
  notas: number;
  cards: number;
  notas_por_note_type: unknown;
  detalhe_notas: NotaImportada[];
  avisos: unknown[];
  erros: unknown[];
}

/** Importa o .apkg com o importador oficial do Anki (sem GUI) e devolve o relatório JSON. */
export async function importarNoAnki(arquivoApkg: string): Promise<ResultadoImportacao> {
  const { stdout } = await executar(PYTHON_ANKI, ['-I', IMPORTADOR_ANKI, arquivoApkg, '--json'], {
    cwd: RAIZ,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  });
  return JSON.parse(stdout) as ResultadoImportacao;
}
