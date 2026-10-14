import type { ZodType, ZodTypeDef } from 'zod';
import {
  CLOZE_REGEX,
  OrcamentoEsgotadoError,
  RespostaExtracaoSchema,
  RespostaGeracaoSchema,
  RespostaLlmInvalidaError,
  type Card,
  type ChunkDocumento,
  type EstagioLlm,
  type Fato,
  type LlmCliente,
  type LlmRequisicao,
  type Orcamento,
  type ParametrosGeracao,
  type TipoGeracao,
} from '@cardify/shared';
import { removerMarcacaoCloze, validarCloze, type MotivoClozeInvalido } from './cloze';
import { executarEmPool } from './concorrencia';
import { deduplicarCards } from './dedup';
import { chamarEstruturado } from './llm/estruturado';
import {
  mensagemExtracao,
  mensagemFormulacao,
  mensagemReformulacaoCloze,
  mensagemRegeneracao,
  metaDeCards,
  sistemaExtracao,
  sistemaFormulacao,
} from './prompts';

export interface ChunkPersistido extends ChunkDocumento {
  id: string;
}

export interface EntradaGeracao {
  jobId: string;
  chunks: ChunkPersistido[];
  parametros: ParametrosGeracao;
  orcamento: Orcamento;
  /** Para a amostra/anônimo: corta a geração ao atingir o limite. */
  limiteCards?: number;
}

export interface CardGerado extends Card {
  chunkId: string;
}

export interface ResultadoGeracao {
  cards: CardGerado[];
  parcial: boolean;
  motivoParcial?: 'orcamento' | 'limite_cards';
  chunksDescartados: number;
  reparosJson: number;
  clozeReprovados: number;
  duplicadosRemovidos: number;
}

export type AoProgredir = (chunksFeitos: number, chunksTotal: number, cardsAteAgora: number) => void | Promise<void>;

const CONCORRENCIA_CHUNKS = 3;
const MAX_FRENTE = 300;
const MAX_VERSO = 500;

interface Contadores {
  reparosJson: number;
  clozeReprovados: number;
}

interface ContextoCards {
  cliente: LlmCliente;
  jobId: string;
  orcamento: Orcamento;
  parametros: ParametrosGeracao;
  trilhaTitulos: readonly string[];
  texto: string;
  contadores: Contadores;
}

async function chamar<T>(
  c: ContextoCards,
  estagio: EstagioLlm,
  req: LlmRequisicao,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<T> {
  const { valor, reparado } = await chamarEstruturado(c.cliente, { jobId: c.jobId, estagio, orcamento: c.orcamento }, req, schema);
  if (reparado) c.contadores.reparosJson++;
  return valor;
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(Math.max(valor, min), max);
}

/** Cloze que não passou na validação vira básico: oclusões viram `____` e o verso reúne o que foi ocluído. */
function clozeParaBasico(card: Card): Card {
  const base = card.textoCloze ?? card.frente;
  const oclusoes = [...base.matchAll(CLOZE_REGEX)];
  if (oclusoes.length === 0) return { ...card, tipo: 'basico', textoCloze: null };
  return {
    ...card,
    tipo: 'basico',
    frente: base.replace(CLOZE_REGEX, '____').slice(0, MAX_FRENTE),
    verso: oclusoes
      .map((m) => (m[2] ?? '').trim())
      .join('; ')
      .slice(0, MAX_VERSO),
    textoCloze: null,
  };
}

async function reformularCloze(c: ContextoCards, card: Card, motivo: MotivoClozeInvalido): Promise<Card | null> {
  try {
    const { cards } = await chamar(
      c,
      'reformulacao_cloze',
      {
        tier: 'forte',
        sistema: sistemaFormulacao(c.parametros.area),
        mensagens: [{ papel: 'user', conteudo: mensagemReformulacaoCloze(card, motivo, c.parametros.area) }],
        maxTokens: 600,
        tokensSaidaEstimados: 250,
      },
      RespostaGeracaoSchema,
    );
    return cards[0] ?? null;
  } catch (erro) {
    if (erro instanceof RespostaLlmInvalidaError) return null;
    throw erro;
  }
}

/** Normaliza campos controlados pelo código e garante cloze válido (uma reformulação; depois, básico). */
async function finalizarCard(c: ContextoCards, bruto: Card): Promise<Card> {
  const card: Card = {
    ...bruto,
    tagSecao: c.trilhaTitulos[c.trilhaTitulos.length - 1] ?? '',
    fonteOffset: limitar(bruto.fonteOffset, 0, c.texto.length),
  };

  if (card.tipo === 'basico') return { ...card, textoCloze: null };
  if (c.parametros.tipo === 'basico') return clozeParaBasico(card);

  const validacao = validarCloze(card.textoCloze ?? '');
  if (validacao.ok) return card;

  c.contadores.clozeReprovados++;
  const reformulado = await reformularCloze(c, card, validacao.motivo);
  if (reformulado?.tipo === 'cloze' && validarCloze(reformulado.textoCloze ?? '').ok) {
    return { ...reformulado, tagSecao: card.tagSecao, fonteOffset: card.fonteOffset };
  }
  return clozeParaBasico(card);
}

async function processarChunk(
  cliente: LlmCliente,
  entrada: EntradaGeracao,
  chunk: ChunkPersistido,
  contadores: Contadores,
): Promise<CardGerado[]> {
  const c: ContextoCards = {
    cliente,
    jobId: entrada.jobId,
    orcamento: entrada.orcamento,
    parametros: entrada.parametros,
    trilhaTitulos: chunk.trilhaTitulos,
    texto: chunk.texto,
    contadores,
  };

  const { fatos } = await chamar(
    c,
    'extracao',
    {
      tier: 'economico',
      sistema: sistemaExtracao(),
      mensagens: [{ papel: 'user', conteudo: mensagemExtracao(chunk) }],
      maxTokens: 2000,
      tokensSaidaEstimados: Math.ceil(chunk.tokens * 0.6) + 300,
    },
    RespostaExtracaoSchema,
  );
  if (fatos.length === 0) return [];

  const fatosLimitados = fatos.map((f) => ({ ...f, fonteOffset: limitar(f.fonteOffset, 0, chunk.texto.length) }));
  const meta = metaDeCards(chunk, entrada.parametros.densidade, fatosLimitados.length);
  const { cards } = await chamar(
    c,
    'formulacao',
    {
      tier: 'forte',
      sistema: sistemaFormulacao(entrada.parametros.area),
      mensagens: [
        {
          papel: 'user',
          conteudo: mensagemFormulacao({
            fatos: fatosLimitados,
            preferencia: entrada.parametros.tipo,
            trilhaTitulos: chunk.trilhaTitulos,
            area: entrada.parametros.area,
            meta,
          }),
        },
      ],
      maxTokens: 4000,
      tokensSaidaEstimados: meta * 120 + 400,
    },
    RespostaGeracaoSchema,
  );

  const finais: CardGerado[] = [];
  for (const bruto of cards) {
    finais.push({ ...(await finalizarCard(c, bruto)), chunkId: chunk.id });
  }
  return finais;
}

function descreverFalha(erro: unknown): string {
  if (erro instanceof RespostaLlmInvalidaError) return erro.name;
  return erro instanceof Error ? `${erro.name}: ${erro.message}` : 'erro desconhecido';
}

interface ResultadoChunk {
  ordem: number;
  indice: number;
  cards: CardGerado[];
}

function emOrdem(resultados: ResultadoChunk[]): CardGerado[] {
  return [...resultados].sort((a, b) => a.ordem - b.ordem || a.indice - b.indice).flatMap((r) => r.cards);
}

/** Estágio A (fatos) + estágio B (cards) + validação de cloze + dedup (RFC §4). */
export async function gerarCards(cliente: LlmCliente, entrada: EntradaGeracao, aoProgredir?: AoProgredir): Promise<ResultadoGeracao> {
  const contadores: Contadores = { reparosJson: 0, clozeReprovados: 0 };
  const resultados: ResultadoChunk[] = [];
  const total = entrada.chunks.length;
  const limite = entrada.limiteCards;

  let chunksFeitos = 0;
  let chunksDescartados = 0;
  let cardsBrutos = 0;
  let orcamentoEsgotado = false;
  let limiteAtingido = limite !== undefined && limite <= 0;
  let ultimoErro: unknown;

  const tarefa = async (chunk: ChunkPersistido, indice: number): Promise<void> => {
    try {
      const cards = await processarChunk(cliente, entrada, chunk, contadores);
      resultados.push({ ordem: chunk.ordem, indice, cards });
      cardsBrutos += cards.length;
      if (limite !== undefined && deduplicarCards(emOrdem(resultados)).mantidos.length >= limite) limiteAtingido = true;
    } catch (erro) {
      if (erro instanceof OrcamentoEsgotadoError) {
        orcamentoEsgotado = true;
      } else {
        chunksDescartados++;
        ultimoErro = erro;
        console.warn(`[geracao] chunk descartado (job ${entrada.jobId}, chunk ${chunk.id}, ordem ${chunk.ordem}): ${descreverFalha(erro)}`);
      }
    }
    chunksFeitos++;
    await aoProgredir?.(chunksFeitos, total, cardsBrutos);
  };

  await executarEmPool(entrada.chunks, CONCORRENCIA_CHUNKS, tarefa, () => orcamentoEsgotado || limiteAtingido);

  if (total > 0 && chunksDescartados === total) throw ultimoErro;

  const { mantidos, removidos } = deduplicarCards(emOrdem(resultados));
  const cortar = limite !== undefined && (limiteAtingido || mantidos.length > limite);

  const resultado: ResultadoGeracao = {
    cards: cortar ? mantidos.slice(0, limite) : mantidos,
    parcial: orcamentoEsgotado || cortar,
    chunksDescartados,
    reparosJson: contadores.reparosJson,
    clozeReprovados: contadores.clozeReprovados,
    duplicadosRemovidos: removidos.length,
  };
  if (cortar) resultado.motivoParcial = 'limite_cards';
  else if (orcamentoEsgotado) resultado.motivoParcial = 'orcamento';
  return resultado;
}

function trechoFonte(card: Card, texto: string): Fato {
  const offset = limitar(card.fonteOffset, 0, texto.length);
  const frase = /^\s*[^.!?]+[.!?]*/.exec(texto.slice(offset))?.[0].trim() ?? '';
  const afirmacao = frase.length >= 10 ? frase : card.textoCloze ? removerMarcacaoCloze(card.textoCloze) : card.verso;
  return { afirmacao: afirmacao.slice(0, 500), categoria: 'relacao', fonteOffset: offset };
}

/** Gera um card substituto para o botão "regenerar este card". */
export async function regenerarCard(
  cliente: LlmCliente,
  ctx: { jobId: string; orcamento: Orcamento },
  card: Card,
  chunk: ChunkDocumento,
  parametros: ParametrosGeracao,
): Promise<Card> {
  const c: ContextoCards = {
    cliente,
    jobId: ctx.jobId,
    orcamento: ctx.orcamento,
    parametros,
    trilhaTitulos: chunk.trilhaTitulos,
    texto: chunk.texto,
    contadores: { reparosJson: 0, clozeReprovados: 0 },
  };
  const preferencia: TipoGeracao = parametros.tipo === 'basico' ? 'basico' : card.tipo;

  const { cards } = await chamar(
    c,
    'regeneracao',
    {
      tier: 'forte',
      sistema: sistemaFormulacao(parametros.area),
      mensagens: [
        { papel: 'user', conteudo: mensagemRegeneracao({ chunk, card, fato: trechoFonte(card, chunk.texto), preferencia, area: parametros.area }) },
      ],
      maxTokens: 1000,
      tokensSaidaEstimados: 300,
    },
    RespostaGeracaoSchema,
  );

  const novo = cards[0];
  if (!novo) throw new RespostaLlmInvalidaError('regeneração sem nenhum card', JSON.stringify({ cards }));
  return finalizarCard(c, { ...novo, fonteOffset: card.fonteOffset });
}
