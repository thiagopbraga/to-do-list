import { createHash } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import {
  DocumentoInvalidoError,
  type MotivoDocumentoInvalido,
  type ResultadoIngestao,
} from '@cardify/shared';
import { chunkTexto } from './chunking';

export interface LimitesIngestao {
  maxBytes: number;
  maxPaginas: number;
  timeoutMs: number;
  /** Heap do processo filho, em MB. */
  maxMemoriaMb?: number;
}

/** Resposta do processo filho ao pai (contrato interno entre runner.ts e processo-filho.ts). */
export type RespostaFilho =
  | { ok: true; resultado: Omit<ResultadoIngestao, 'sha256' | 'bytes'> }
  | { ok: false; motivo: MotivoDocumentoInvalido; mensagem: string };

const MEMORIA_PADRAO_MB = 512;
const BLOCO_HASH = 1024 * 1024;
const GRACA_ENCERRAMENTO_MS = 5_000;

/** Só o necessário para o Node rodar: nenhuma credencial (DATABASE_URL, S3_*, chaves de LLM) chega ao filho. */
function ambienteMinimo(): NodeJS.ProcessEnv {
  const ambiente: NodeJS.ProcessEnv = {};
  if (process.env.NODE_ENV !== undefined) ambiente.NODE_ENV = process.env.NODE_ENV;
  if (process.env.PATH !== undefined) ambiente.PATH = process.env.PATH;
  return ambiente;
}

/**
 * Exportado para teste de isolamento. O filho é `.ts` sob vitest/tsx e `.js` a partir do `dist`;
 * no primeiro caso o tsx é carregado com `cwd` na pasta do arquivo para resolver o pacote da raiz.
 */
export function iniciarProcessoFilho(maxMemoriaMb: number = MEMORIA_PADRAO_MB): ChildProcess {
  const extensao = path.extname(__filename);
  const arquivo = path.join(__dirname, `processo-filho${extensao}`);
  const execArgv = [`--max-old-space-size=${maxMemoriaMb}`];
  if (extensao === '.ts') execArgv.push('--import', 'tsx');

  return fork(arquivo, [], {
    serialization: 'advanced',
    execArgv,
    env: ambienteMinimo(),
    cwd: __dirname,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
}

export function calcularSha256(dados: Uint8Array | string): string {
  const hash = createHash('sha256');
  const bytes = typeof dados === 'string' ? Buffer.from(dados, 'utf8') : dados;
  for (let inicio = 0; inicio < bytes.length; inicio += BLOCO_HASH) {
    hash.update(bytes.subarray(inicio, inicio + BLOCO_HASH));
  }
  return hash.digest('hex');
}

const ehRespostaFilho = (valor: unknown): valor is RespostaFilho =>
  typeof valor === 'object' && valor !== null && typeof (valor as { ok?: unknown }).ok === 'boolean';

function executarNoFilho(dados: Buffer, limites: LimitesIngestao): Promise<RespostaFilho> {
  return new Promise<RespostaFilho>((resolver, rejeitar) => {
    const filho = iniciarProcessoFilho(limites.maxMemoriaMb);
    let resposta: RespostaFilho | undefined;
    let estourouTempo = false;
    let encerrado = false;

    const matar = () => {
      if (filho.exitCode === null && filho.signalCode === null) filho.kill('SIGKILL');
    };
    const prazo = setTimeout(() => {
      estourouTempo = true;
      matar();
    }, limites.timeoutMs);
    let graca: NodeJS.Timeout | undefined;

    const finalizar = (acao: () => void) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(prazo);
      clearTimeout(graca);
      filho.removeAllListeners();
      matar();
      acao();
    };

    filho.on('message', (mensagem: unknown) => {
      if (!ehRespostaFilho(mensagem)) return;
      resposta = mensagem;
      // O filho se encerra sozinho; se não o fizer, não fica pendurado.
      graca = setTimeout(matar, GRACA_ENCERRAMENTO_MS);
    });

    filho.on('error', (erro) => {
      finalizar(() =>
        rejeitar(new DocumentoInvalidoError('corrompido', `Não foi possível processar o arquivo: ${erro.message}`)),
      );
    });

    // Só decidimos depois do 'exit': garante que o filho já foi encerrado e recolhido (sem zumbi).
    filho.on('exit', (codigo, sinal) => {
      finalizar(() => {
        if (estourouTempo) {
          rejeitar(
            new DocumentoInvalidoError(
              'timeout',
              `O processamento do arquivo excedeu o tempo limite de ${Math.round(limites.timeoutMs / 1000)} segundos.`,
            ),
          );
        } else if (resposta) {
          resolver(resposta);
        } else {
          rejeitar(
            new DocumentoInvalidoError(
              'corrompido',
              `O arquivo não pôde ser processado: o leitor de PDF foi encerrado inesperadamente (${
                sinal ? `sinal ${sinal}` : `código ${codigo}`
              }).`,
            ),
          );
        }
      });
    });

    filho.send({ dados, maxPaginas: limites.maxPaginas }, (erro) => {
      if (erro) matar();
    });
  });
}

/**
 * Valida magic bytes, calcula SHA-256 e roda extração + limpeza + chunking
 * em processo filho isolado (RFC §3.1). Lança DocumentoInvalidoError.
 */
export async function ingerirPdfIsolado(dados: Buffer, limites: LimitesIngestao): Promise<ResultadoIngestao> {
  if (dados.length > limites.maxBytes) {
    const maxMb = Math.round((limites.maxBytes / (1024 * 1024)) * 10) / 10;
    throw new DocumentoInvalidoError('muito_grande', `O arquivo excede o tamanho máximo de ${maxMb} MB.`);
  }
  if ((await detectarTipo(dados)) !== 'pdf') {
    throw new DocumentoInvalidoError('tipo_invalido', 'O arquivo enviado não é um PDF válido.');
  }
  const sha256 = calcularSha256(dados);

  const resposta = await executarNoFilho(dados, limites);
  if (!resposta.ok) throw new DocumentoInvalidoError(resposta.motivo, resposta.mensagem);

  return { sha256, bytes: dados.length, ...resposta.resultado };
}

/** Texto colado: sem processo filho, só limites + chunkTexto. */
export function ingerirTexto(texto: string, maxCaracteres: number): ResultadoIngestao {
  const limpo = texto.trim();
  if (limpo.length === 0) {
    throw new DocumentoInvalidoError('vazio', 'O texto enviado está vazio.');
  }
  if (limpo.length > maxCaracteres) {
    throw new DocumentoInvalidoError(
      'muito_grande',
      `O texto tem ${limpo.length} caracteres; o máximo permitido é ${maxCaracteres}.`,
    );
  }
  const chunks = chunkTexto(limpo);
  if (chunks.length === 0) {
    throw new DocumentoInvalidoError('vazio', 'O texto enviado não tem conteúdo aproveitável.');
  }
  return {
    sha256: calcularSha256(limpo),
    paginas: 0,
    bytes: Buffer.byteLength(limpo, 'utf8'),
    totalCaracteres: limpo.length,
    chunks,
  };
}

/** Detecta o tipo real pelos magic bytes (file-type, ESM-only). */
export async function detectarTipo(dados: Uint8Array): Promise<'pdf' | 'desconhecido'> {
  const { fileTypeFromBuffer } = await import('file-type');
  const tipo = await fileTypeFromBuffer(dados);
  return tipo?.mime === 'application/pdf' ? 'pdf' : 'desconhecido';
}
