/**
 * Contratos entre pacotes. Interfaces congeladas: implementações não mudam assinaturas;
 * mudanças passam pelo gerente do projeto.
 * Somente tipos — este arquivo não gera código em runtime e é seguro para o front.
 */
import type { CardTipo } from './schemas/card';
import type { Estagio, JobStatus, ProgressoEvento } from './schemas/job';
import type { MetodoPagamento, Plano } from './schemas/plano';
import type { NomeFila } from './constants';

// ───────────────────────────── Ingestão (libs/ingest) ─────────────────────────────

export interface LinhaPdf {
  texto: string;
  /** Tamanho de fonte estimado em pontos (RFC §3.2: hypot(transform[2], transform[3])). */
  fonteTamanho: number;
  /** Sinal secundário, inferido pelo fontName (Bold/Black). */
  negrito: boolean;
  /** Posição vertical normalizada da linha: 0 = topo da página, 1 = base. */
  yNorm: number;
  /** Posição horizontal normalizada do início da linha: 0 = esquerda, 1 = direita. */
  xNorm: number;
}

export interface PaginaPdf {
  /** 1-based. */
  numero: number;
  largura: number;
  altura: number;
  /** Linhas em ordem de leitura (de cima para baixo, esquerda para direita). */
  linhas: LinhaPdf[];
}

export interface DocumentoExtraido {
  paginas: PaginaPdf[];
  totalCaracteres: number;
  /** caracteres / páginas < LIMITES_DOCUMENTO.minCaracteresPorPagina. */
  escaneado: boolean;
}

export interface OpcoesExtracao {
  maxPaginas?: number;
}

export interface PdfExtractor {
  extrair(dados: Uint8Array, opcoes?: OpcoesExtracao): Promise<DocumentoExtraido>;
}

export interface ChunkDocumento {
  /** 0-based, ordem de leitura. */
  ordem: number;
  /** Ex.: ['Fisiologia', 'Cardiovascular', 'Ciclo cardíaco']. Vazio quando não há estrutura. */
  trilhaTitulos: string[];
  texto: string;
  tokens: number;
}

/** Resultado do processo isolado de ingestão (RFC §3.1). */
export interface ResultadoIngestao {
  sha256: string;
  paginas: number;
  bytes: number;
  totalCaracteres: number;
  chunks: ChunkDocumento[];
}

// ───────────────────────────── Geração / LLM (libs/generation) ─────────────────────────────

/** 'economico' = estágio A (extração); 'forte' = estágio B (formulação). */
export type LlmTier = 'economico' | 'forte';

export interface LlmMensagem {
  papel: 'user' | 'assistant';
  conteudo: string;
}

export interface LlmRequisicao {
  tier: LlmTier;
  sistema: string;
  mensagens: LlmMensagem[];
  maxTokens: number;
  temperatura?: number;
  /** JSON Schema que a saída deve obedecer (saída estruturada). */
  jsonSchema?: Record<string, unknown>;
}

export interface LlmResposta {
  texto: string;
  /** ID real do modelo que respondeu. */
  modelo: string;
  tokensIn: number;
  tokensOut: number;
  latenciaMs: number;
}

/** Provedor cru (Anthropic, fake). Só o LlmCliente pode chamá-lo diretamente. */
export interface LlmProvider {
  completar(req: LlmRequisicao): Promise<LlmResposta>;
}

export type EstagioLlm = 'extracao' | 'formulacao' | 'reparo' | 'reformulacao_cloze' | 'regeneracao';

/** Orçamento por job (RFC §4.5). Valores em centavos de real; frações são permitidas. */
export interface Orcamento {
  readonly tetoCentavos: number;
  readonly gastoCentavos: number;
  /** Debita a estimativa antes da chamada. Lança OrcamentoEsgotadoError se passar do teto. */
  reservar(estimativaCentavos: number): void;
  /** Troca a estimativa pelo custo real depois da chamada. */
  ajustar(estimativaCentavos: number, realCentavos: number): void;
}

export interface ContextoChamadaLlm {
  jobId: string;
  estagio: EstagioLlm;
  orcamento: Orcamento;
}

export interface RegistroChamadaLlm {
  jobId: string;
  estagio: EstagioLlm;
  modelo: string;
  tokensIn: number;
  tokensOut: number;
  custoCentavos: number;
  latenciaMs: number;
}

/** Persistência do ledger `llm_calls`. Implementado sobre o banco pelo worker. */
export interface LedgerLlm {
  registrar(registro: RegistroChamadaLlm): Promise<void>;
}

/**
 * Único ponto de chamada de LLM do sistema: aplica orçamento e grava no ledger.
 * Código de geração recebe LlmCliente, nunca LlmProvider.
 */
export interface LlmCliente {
  chamar(ctx: ContextoChamadaLlm, req: LlmRequisicao): Promise<LlmResposta>;
}

// ───────────────────────────── Fila e progresso (libs/queue) ─────────────────────────────

export interface OpcoesEnvio {
  singletonKey?: string;
  retryLimit?: number;
  expireInMinutes?: number;
}

export interface MetaJobFila {
  id: string;
}

export interface FilaService {
  iniciar(): Promise<void>;
  parar(): Promise<void>;
  /** Retorna o id do job na fila, ou null se deduplicado por singletonKey. */
  enviar<T extends object>(fila: NomeFila, payload: T, opcoes?: OpcoesEnvio): Promise<string | null>;
  processar<T extends object>(
    fila: NomeFila,
    handler: (payload: T, meta: MetaJobFila) => Promise<void>,
    opcoes?: { concorrencia?: number },
  ): Promise<void>;
}

export interface PayloadGerarBaralho {
  jobId: string;
}

export interface PayloadGerarExport {
  exportId: string;
}

export interface ProgressoPublisher {
  publicar(evento: ProgressoEvento): Promise<void>;
}

export interface ProgressoSubscriber {
  /** Retorna função para cancelar a assinatura. */
  assinar(jobId: string, aoReceber: (evento: ProgressoEvento) => void): Promise<() => Promise<void>>;
}

// ───────────────────────────── Storage (libs/storage) ─────────────────────────────

export interface UploadAssinado {
  /** POST multipart com `campos` + arquivo no campo `file`. Limite de tamanho imposto pela política. */
  url: string;
  campos: Record<string, string>;
}

export interface StorageService {
  urlUpload(chave: string, opcoes: { contentType: string; maxBytes: number; ttlSegundos?: number }): Promise<UploadAssinado>;
  urlDownload(chave: string, opcoes?: { ttlSegundos?: number; nomeArquivo?: string }): Promise<string>;
  ler(chave: string): Promise<Buffer>;
  gravar(chave: string, corpo: Buffer | Uint8Array | string, contentType: string): Promise<void>;
  apagar(chave: string): Promise<void>;
  metadados(chave: string): Promise<{ bytes: number; contentType?: string } | null>;
}

// ───────────────────────────── Exportação (libs/apkg) ─────────────────────────────

export interface NotaExportavel {
  /** UUID do card no banco. Origem do GUID estável (RFC §5.4). */
  id: string;
  tipo: CardTipo;
  frente: string;
  verso: string;
  /** Obrigatório quando tipo = 'cloze'. */
  textoCloze: string | null;
  trilhaTitulos: string[];
  /** Tags extras do usuário; as tags `cardify::...` são geradas pelo empacotador. */
  tags: string[];
  ordem: number;
}

export interface PacoteBaralho {
  /** Nome do baralho raiz (derivado do arquivo de origem). */
  nomeBaralho: string;
  slugDocumento: string;
  notas: NotaExportavel[];
}

export interface ApkgPacker {
  empacotar(pacote: PacoteBaralho): Promise<Buffer>;
}

// ───────────────────────────── Pagamento ─────────────────────────────

export type PlanoPago = Exclude<Plano, 'gratis'>;

export interface ClientePagamento {
  userId: string;
  email: string;
  nome?: string;
  cpfCnpj?: string;
  providerCustomerId?: string | null;
}

export interface ResultadoAssinatura {
  providerSubId: string;
  providerCustomerId: string;
  status: 'pendente' | 'ativa';
  urlPagamento?: string;
  pixCopiaECola?: string;
  pixQrCodeBase64?: string;
}

export type TipoEventoPagamento = 'pagamento_confirmado' | 'pagamento_atrasado' | 'assinatura_cancelada' | 'reembolso';

export interface EventoPagamento {
  /** Usado para processamento idempotente. */
  eventId: string;
  tipo: TipoEventoPagamento;
  providerSubId: string;
  valorCentavos?: number;
  ocorridoEm: string;
}

export interface PagamentoProvider {
  criarAssinatura(cliente: ClientePagamento, plano: PlanoPago, metodo: MetodoPagamento): Promise<ResultadoAssinatura>;
  cancelarAssinatura(providerSubId: string): Promise<void>;
  /** Verifica autenticidade sobre o corpo bruto. Lança WebhookInvalidoError; retorna null para eventos ignoráveis. */
  interpretarWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): EventoPagamento | null;
}

// ───────────────────────────── Utilitários de status ─────────────────────────────

export interface ProgressoJob {
  status: JobStatus;
  estagio: Estagio | null;
  percentual: number;
}
