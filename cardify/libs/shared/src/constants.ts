/** IDs de note type do Anki. Fixos e versionados: NUNCA mudar nem gerar em runtime (RFC §5.3). */
export const MODEL_ID_BASICO = 1607392319;
export const MODEL_ID_CLOZE = 1607392320;

/** Prefixo de todas as tags exportadas: `cardify::<slug-documento>::<slug-secao>` (RFC §5.6). */
export const PREFIXO_TAG = 'cardify';

/** Profundidade máxima de subdecks derivados da trilha de títulos (RFC §5.6). */
export const MAX_NIVEIS_SUBDECK = 3;

export const LIMITES_DOCUMENTO = {
  maxBytes: 50 * 1024 * 1024,
  maxPaginas: 300,
  maxCaracteresTexto: 50_000,
  timeoutParsingMs: 10 * 60 * 1000,
  /** Abaixo disso (caracteres / página) o PDF é tratado como escaneado (RFC §3.2). */
  minCaracteresPorPagina: 80,
} as const;

export const LIMITES_ANONIMO = {
  maxCards: 10,
  maxPaginas: 15,
  maxBytes: 5 * 1024 * 1024,
  geracoesPorIpPorDia: 2,
  /** A partir desta geração (1-based) exige Turnstile. */
  turnstileAPartirDe: 2,
  sessaoTtlSegundos: 24 * 60 * 60,
} as const;

export const CHUNKING = {
  maxTokens: 2000,
  sobreposicaoTokens: 120,
  minTokens: 200,
} as const;

export const DEDUP_LIMIAR_JACCARD = 0.85;

/** `.*?` (e não `.+?`) para que `{{c1::}}` seja reconhecido como oclusão vazia. */
export const CLOZE_REGEX = /\{\{c(\d+)::(.*?)(::.*?)?\}\}/g;
export const CLOZE_MIN_CONTEXTO_CHARS = 15;

/** Teto de custo de LLM por baralho de 100 cards, em centavos de real (PRD §8). */
export const CUSTO_MAX_CENTAVOS_POR_100_CARDS = 60;

export const URL_ASSINADA_TTL_SEGUNDOS = 15 * 60;

export const FILAS = {
  gerarBaralho: 'gerar-baralho',
  gerarExport: 'gerar-export',
} as const;
export type NomeFila = (typeof FILAS)[keyof typeof FILAS];

/** Canal Postgres LISTEN/NOTIFY para progresso de jobs. */
export const CANAL_PROGRESSO = 'cardify_progresso';
