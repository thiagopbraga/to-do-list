import { CLOZE_MIN_CONTEXTO_CHARS, CLOZE_REGEX, type CardRevisao } from '@cardify/shared';
import { ErroApi } from '@/lib/api';

export const SEM_SECAO = 'Sem seção';

export function hrefEntrar(jobId: string): string {
  return `/entrar?retorno=/revisar/${jobId}`;
}

// ─────────────── seções ───────────────

export interface Secao {
  chave: string;
  titulo: string;
  cards: CardRevisao[];
}

export function tituloDaSecao(card: Pick<CardRevisao, 'trilhaTitulos'>): string {
  const ultimo = card.trilhaTitulos[card.trilhaTitulos.length - 1]?.trim();
  return ultimo ? ultimo : SEM_SECAO;
}

/** Agrupa preservando a ordem de primeira aparição das seções e a ordem dos cards dentro de cada uma. */
export function agruparPorSecao(cards: readonly CardRevisao[]): Secao[] {
  const porChave = new Map<string, Secao>();
  for (const card of cards) {
    const titulo = tituloDaSecao(card);
    let secao = porChave.get(titulo);
    if (!secao) {
      secao = { chave: titulo, titulo, cards: [] };
      porChave.set(titulo, secao);
    }
    secao.cards.push(card);
  }
  return [...porChave.values()];
}

// ─────────────── busca ───────────────

export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function cardCombinaBusca(card: CardRevisao, buscaNormalizada: string): boolean {
  if (buscaNormalizada === '') return true;
  const palheiro = normalizarBusca([card.frente, card.verso, card.textoCloze ?? '', ...card.tags].join('\n'));
  return palheiro.includes(buscaNormalizada);
}

// ─────────────── tags ───────────────

/** Tags do Anki não podem ter espaços. */
export function normalizarTag(tag: string): string {
  return tag.trim().replace(/\s+/g, '_').slice(0, 60);
}

export function tagsUnicas(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normalizarTag).filter((tag) => tag !== ''))];
}

// ─────────────── cloze ───────────────

export type MotivoCloze =
  | 'sem_oclusao'
  | 'indices_nao_contiguos'
  | 'oclusao_vazia'
  | 'oclusao_frase_inteira'
  | 'chaves_desbalanceadas'
  | 'pouco_contexto'
  | 'texto_cloze_ausente';

export const MENSAGEM_MOTIVO_CLOZE: Record<MotivoCloze, string> = {
  sem_oclusao: 'Marque ao menos um trecho para ocultar, no formato {{c1::resposta}}.',
  indices_nao_contiguos: 'Os números das oclusões precisam ser sequenciais: c1, c2, c3, sem pular nenhum.',
  oclusao_vazia: 'Há uma oclusão vazia. Escreva a resposta dentro de {{c1::...}} ou remova a marcação.',
  oclusao_frase_inteira: 'Você ocultou a frase inteira. Deixe parte do texto visível para dar contexto.',
  chaves_desbalanceadas: 'Há chaves sobrando ou faltando. Cada {{ precisa de um }} correspondente.',
  pouco_contexto: 'Sobrou pouco texto visível. Oculte menos palavras para o card ter contexto.',
  texto_cloze_ausente: 'Escreva o texto do cloze com ao menos uma oclusão, como {{c1::resposta}}.',
};

export function mensagemMotivoCloze(motivo: string | undefined): string {
  if (motivo && motivo in MENSAGEM_MOTIVO_CLOZE) return MENSAGEM_MOTIVO_CLOZE[motivo as MotivoCloze];
  return 'O texto cloze não é válido. Confira as marcações {{c1::resposta}}.';
}

function ocorrenciasCloze(texto: string): RegExpMatchArray[] {
  return [...texto.matchAll(CLOZE_REGEX)];
}

export function removerMarcacaoCloze(texto: string): string {
  return texto.replace(new RegExp(CLOZE_REGEX.source, 'g'), (_marcacao, _indice: string, conteudo: string) => conteudo);
}

function normalizarFrase(texto: string): string {
  return texto
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\s.!?;:…]+$/, '');
}

/**
 * Espelha `validarCloze` da API para dar o motivo sem depender do corpo do 422
 * (o cliente HTTP só repassa `erro` e `mensagem`). A API continua sendo a autoridade.
 */
export function validarClozeLocal(texto: string | null): MotivoCloze | null {
  if (texto === null || texto.trim() === '') return 'texto_cloze_ausente';
  const regex = new RegExp(CLOZE_REGEX.source, 'g');
  const abertas = texto.split('{{').length - 1;
  const fechadas = texto.split('}}').length - 1;
  const oclusoes = ocorrenciasCloze(texto);
  if (abertas !== fechadas || /[{}]/.test(texto.replace(regex, ''))) return 'chaves_desbalanceadas';
  if (oclusoes.length === 0) return 'sem_oclusao';
  if (oclusoes.some((m) => m[2].trim() === '')) return 'oclusao_vazia';
  const indices = [...new Set(oclusoes.map((m) => Number(m[1])))].sort((a, b) => a - b);
  if (indices.some((indice, posicao) => indice !== posicao + 1)) return 'indices_nao_contiguos';
  const ocultos = oclusoes.map((m) => m[2]).join(' ');
  if (normalizarFrase(ocultos) === normalizarFrase(removerMarcacaoCloze(texto))) return 'oclusao_frase_inteira';
  const contexto = texto.replace(new RegExp(CLOZE_REGEX.source, 'g'), ' ').replace(/\s+/g, ' ').trim();
  if (contexto.length < CLOZE_MIN_CONTEXTO_CHARS) return 'pouco_contexto';
  return null;
}

export type ParteCloze = { texto: string; oclusao?: { indice: number; dica?: string } };

/** Quebra o texto em trechos visíveis e oclusões, para a pré-visualização. */
export function partesCloze(texto: string): ParteCloze[] {
  const partes: ParteCloze[] = [];
  let cursor = 0;
  for (const m of ocorrenciasCloze(texto)) {
    const inicio = m.index ?? 0;
    if (inicio > cursor) partes.push({ texto: texto.slice(cursor, inicio) });
    const dica = m[3]?.slice(2);
    partes.push({ texto: m[2], oclusao: { indice: Number(m[1]), dica: dica ? dica : undefined } });
    cursor = inicio + m[0].length;
  }
  if (cursor < texto.length) partes.push({ texto: texto.slice(cursor) });
  return partes;
}

export function respostasCloze(texto: string): string[] {
  return ocorrenciasCloze(texto).map((m) => m[2]);
}

/** Próximo índice livre para uma nova oclusão. */
export function proximoIndiceCloze(texto: string): number {
  const maior = Math.max(0, ...ocorrenciasCloze(texto).map((m) => Number(m[1])));
  return maior + 1;
}

/** Envolve o trecho selecionado em `{{cN::...}}`. Devolve o texto novo e a posição do cursor. */
export function ocultarSelecao(texto: string, inicio: number, fim: number): { texto: string; cursor: number } | null {
  const trecho = texto.slice(inicio, fim);
  if (trecho.trim() === '') return null;
  const marcado = `{{c${proximoIndiceCloze(texto)}::${trecho}}}`;
  return { texto: texto.slice(0, inicio) + marcado + texto.slice(fim), cursor: inicio + marcado.length };
}

// ─────────────── erros ───────────────

export type ContextoErro = 'carregar' | 'salvar' | 'descartar' | 'restaurar' | 'regenerar' | 'lote' | 'ordenar' | 'exportar';

export interface DescricaoErro {
  texto: string;
  href?: string;
  rotuloLink?: string;
}

const ACAO_FALHA: Record<ContextoErro, string> = {
  carregar: 'carregar os cards',
  salvar: 'salvar a edição',
  descartar: 'descartar',
  restaurar: 'restaurar',
  regenerar: 'regenerar o card',
  lote: 'aplicar a ação aos cards selecionados',
  ordenar: 'salvar a nova ordem',
  exportar: 'exportar',
};

export function descreverErro(erro: unknown, contexto: ContextoErro, jobId: string): DescricaoErro {
  if (erro instanceof ErroApi) {
    if (contexto === 'regenerar') {
      if (erro.status === 403 && erro.erro === 'login_necessario') {
        return { texto: 'Para regenerar cards é preciso entrar na sua conta.', href: hrefEntrar(jobId), rotuloLink: 'Entrar' };
      }
      if (erro.erro === 'regeneracao_indisponivel') {
        return { texto: 'A regeneração está indisponível no momento. Tente novamente em alguns minutos.' };
      }
      if (erro.erro === 'regeneracao_falhou') {
        return { texto: 'Não foi possível regenerar este card agora. Tente novamente; o card original foi mantido.' };
      }
      if (erro.erro === 'card_descartado') return { texto: 'Este card já foi descartado. Restaure-o antes de regenerar.' };
    }
    if (contexto === 'exportar') {
      if (erro.status === 401) {
        return { texto: 'Para exportar é preciso entrar na sua conta.', href: hrefEntrar(jobId), rotuloLink: 'Entrar' };
      }
      if (erro.erro === 'job_nao_finalizado') return { texto: 'A geração ainda não terminou. Aguarde para exportar.' };
      if (erro.erro === 'sem_cards') return { texto: 'Não há cards ativos para exportar.' };
    }
    if (contexto === 'carregar' && (erro.status === 404 || erro.status === 403)) {
      return { texto: 'Baralho não encontrado ou sem acesso.' };
    }
    if (erro.status === 401) {
      return { texto: 'Sua sessão expirou. Entre novamente para continuar.', href: hrefEntrar(jobId), rotuloLink: 'Entrar' };
    }
    if (erro.status === 429) return { texto: 'Muitas requisições em sequência. Aguarde um instante e tente de novo.' };
    if (erro.status >= 500) return { texto: `O servidor falhou ao ${ACAO_FALHA[contexto]}. Tente novamente.` };
    return { texto: `Não foi possível ${ACAO_FALHA[contexto]}: ${erro.message}` };
  }
  return { texto: `Sem conexão com o servidor ao ${ACAO_FALHA[contexto]}. Verifique sua internet e tente novamente.` };
}

/** Resumo de 422 de cloze: usa o motivo local porque o corpo do erro não chega ao front. */
export function mensagemErroSalvar(erro: unknown, textoCloze: string | null, jobId: string): { mensagem: string; motivo?: MotivoCloze } {
  if (erro instanceof ErroApi && erro.status === 422 && erro.erro === 'cloze_invalido') {
    const motivo = validarClozeLocal(textoCloze) ?? undefined;
    return { mensagem: mensagemMotivoCloze(motivo), motivo };
  }
  return { mensagem: descreverErro(erro, 'salvar', jobId).texto };
}
