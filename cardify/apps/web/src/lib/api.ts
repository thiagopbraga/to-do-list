import {
  JOB_STATUS_FINAIS,
  ProgressoEventoSchema,
  type CardRevisao,
  type CriarExport,
  type CriarJob,
  type EditarCard,
  type JobResumo,
  type ProgressoEvento,
  type UploadAssinado,
} from '@cardify/shared';

/** Erro devolvido pela API no formato `{ erro, mensagem }`. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly erro: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/**
 * Chamada à API pelo mesmo domínio (o Next reescreve /v1/* para a API), com o cookie de sessão.
 * Corpo JSON quando informado; resposta 204 vira `undefined`.
 */
export async function api<T>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const resposta = await fetch(`/v1${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
    credentials: 'include',
    headers: { ...(opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opcoes.headers },
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
  });
  if (resposta.status === 204) return undefined as T;
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, corpo.erro ?? 'erro_desconhecido', corpo.mensagem ?? `falha HTTP ${resposta.status}`);
  }
  return corpo as T;
}

// ─────────────── uploads e jobs ───────────────

export interface UploadCriado {
  documentId: string;
  upload: UploadAssinado;
}

export const criarUpload = (arquivo: File) =>
  api<UploadCriado>('/uploads', { corpo: { nome: arquivo.name, bytes: arquivo.size, contentType: 'application/pdf' } });

/** Envia o arquivo direto ao storage pela política assinada (não passa pela API). */
export async function enviarArquivo(upload: UploadAssinado, arquivo: File): Promise<void> {
  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(upload.campos)) formulario.append(campo, valor);
  formulario.append('file', arquivo);
  const resposta = await fetch(upload.url, { method: 'POST', body: formulario });
  if (!resposta.ok) throw new ErroApi(resposta.status, 'upload_recusado', 'O armazenamento recusou o arquivo.');
}

export const concluirUpload = (documentId: string) =>
  api<{ documentId: string; sha256: string; bytes: number }>(`/uploads/${documentId}/concluir`, { metodo: 'POST' });

export const criarJob = (corpo: CriarJob) => api<JobResumo>('/jobs', { corpo });
export const obterJob = (jobId: string) => api<JobResumo>(`/jobs/${jobId}`);
export const listarJobs = () => api<JobResumo[]>('/jobs');

export interface Cota {
  plano: string;
  limite: number;
  confirmados: number;
  reservados: number;
  restante: number;
  periodoFim: string;
}
export const obterCota = () => api<Cota>('/cota');

/**
 * Acompanha o progresso de um job por SSE, com polling a cada 3 s como fallback (RFC §8).
 * Retorna a função que encerra o acompanhamento.
 */
export function acompanharJob(jobId: string, aoEvento: (evento: ProgressoEvento) => void): () => void {
  let encerrado = false;
  let intervalo: ReturnType<typeof setInterval> | undefined;
  const fonte = typeof EventSource !== 'undefined' ? new EventSource(`/v1/jobs/${jobId}/events`, { withCredentials: true }) : null;

  const encerrar = () => {
    encerrado = true;
    fonte?.close();
    if (intervalo) clearInterval(intervalo);
  };
  const entregar = (evento: ProgressoEvento) => {
    if (encerrado) return;
    aoEvento(evento);
    if (JOB_STATUS_FINAIS.includes(evento.status)) encerrar();
  };
  const iniciarPolling = () => {
    if (intervalo || encerrado) return;
    const consultar = async () => {
      try {
        const job = await obterJob(jobId);
        entregar({ jobId, status: job.status, estagio: null, percentual: JOB_STATUS_FINAIS.includes(job.status) ? 100 : 50, cardsGerados: job.cardsGerados, mensagem: job.erro ?? undefined });
      } catch {
        // mantém o polling; a próxima tentativa pode funcionar
      }
    };
    void consultar();
    intervalo = setInterval(consultar, 3000);
  };

  if (fonte) {
    fonte.onmessage = (mensagem) => {
      const evento = ProgressoEventoSchema.safeParse(JSON.parse(mensagem.data));
      if (evento.success) entregar(evento.data);
    };
    fonte.onerror = () => {
      fonte.close();
      iniciarPolling();
    };
  } else {
    iniciarPolling();
  }
  return encerrar;
}

// ─────────────── revisão de cards ───────────────

export interface PaginaCards {
  cards: CardRevisao[];
  total: number;
  pagina: number;
  tamanho: number;
}

export const listarCards = (jobId: string, opcoes: { pagina?: number; tamanho?: number; incluirDescartados?: boolean } = {}) => {
  const query = new URLSearchParams({
    pagina: String(opcoes.pagina ?? 1),
    tamanho: String(opcoes.tamanho ?? 500),
    incluirDescartados: String(opcoes.incluirDescartados ?? false),
  });
  return api<PaginaCards>(`/jobs/${jobId}/cards?${query}`);
};

export const editarCard = (cardId: string, corpo: EditarCard) => api<CardRevisao>(`/cards/${cardId}`, { metodo: 'PATCH', corpo });
export const descartarCard = (cardId: string) => api<void>(`/cards/${cardId}`, { metodo: 'DELETE' });
export const regenerarCard = (cardId: string) => api<CardRevisao>(`/cards/${cardId}/regenerate`, { metodo: 'POST' });

export type AcaoLote = 'descartar' | 'restaurar' | 'adicionarTags' | 'removerTags';
export const cardsEmLote = (ids: string[], acao: AcaoLote, tags?: string[]) =>
  api<{ alterados: number }>('/cards/lote', { corpo: { ids, acao, tags } });

export const reordenarCards = (jobId: string, ids: string[]) => api<void>(`/jobs/${jobId}/cards/ordem`, { metodo: 'PUT', corpo: { ids } });

// ─────────────── exportação ───────────────

export const criarExportacao = (corpo: CriarExport) => api<{ id: string; formato: string; bytes: number }>('/exports', { corpo });

/** URL que redireciona (302) para o download assinado. */
export const urlDownload = (exportId: string) => `/v1/exports/${exportId}/download`;
