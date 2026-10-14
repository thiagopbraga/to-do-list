'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { CardRevisao, EditarCard, ExportFormato, JobResumo } from '@cardify/shared';
import {
  cardsEmLote,
  criarExportacao,
  descartarCard,
  editarCard,
  ErroApi,
  listarCards,
  obterJob,
  regenerarCard,
  reordenarCards,
  urlDownload,
} from '@/lib/api';
import {
  agruparPorSecao,
  cardCombinaBusca,
  descreverErro,
  hrefEntrar,
  mensagemErroSalvar,
  mensagemMotivoCloze,
  normalizarBusca,
  normalizarTag,
  removerMarcacaoCloze,
  tagsUnicas,
  validarClozeLocal,
  type DescricaoErro,
  type MotivoCloze,
  type Secao,
} from './utilitarios';

const TAMANHO_PAGINA = 500;
const PRAZO_DESFAZER_MS = 5000;
const PRAZO_AVISO_MS = 5000;

export type ResultadoSalvar = { ok: true } | { ok: false; mensagem: string; motivo?: MotivoCloze };

export type StatusCarga = 'carregando' | 'pronto' | 'job_pendente' | 'erro';

export interface Aviso extends Partial<DescricaoErro> {
  tipo: 'info' | 'erro';
  texto: string;
}

export interface Desfazer {
  rotulo: string;
  ids: string[];
}

/** Ações por card. O objeto é estável entre renders para que `memo` funcione. */
export interface AcoesCard {
  salvar(id: string, patch: EditarCard): Promise<ResultadoSalvar>;
  descartar(id: string): void;
  restaurar(id: string): void;
  regenerar(id: string): void;
  mover(id: string, direcao: -1 | 1): void;
  alternarSelecao(id: string): void;
}

export interface AcoesSelecao {
  alternarSecao(ids: string[], marcar: boolean): void;
  limpar(): void;
  descartar(): void;
  restaurar(): void;
  adicionarTag(tag: string): void;
  removerTag(tag: string): void;
  tagearIds(ids: string[], tag: string): void;
}

export interface OpcoesRevisao {
  /** Navegação completa (fora do roteador) para download e login. Padrão: `window.location.assign`. */
  navegar?: (url: string) => void;
}

const ESTADOS_PRONTOS: readonly JobResumo['status'][] = ['concluido', 'parcial'];

function patchOtimista(card: CardRevisao, patch: EditarCard): Partial<CardRevisao> {
  const parcial: Partial<CardRevisao> = {};
  const tipo = patch.tipo ?? card.tipo;
  if (patch.tipo !== undefined) parcial.tipo = patch.tipo;
  if (patch.verso !== undefined) parcial.verso = patch.verso;
  if (patch.tags !== undefined) parcial.tags = tagsUnicas(patch.tags);
  if (tipo === 'basico') {
    if (patch.frente !== undefined) parcial.frente = patch.frente;
    if (patch.tipo === 'basico') parcial.textoCloze = null;
  } else {
    const textoCloze = patch.textoCloze !== undefined ? patch.textoCloze : card.textoCloze;
    if (patch.textoCloze !== undefined) parcial.textoCloze = patch.textoCloze;
    if (patch.frente !== undefined) parcial.frente = patch.frente;
    else if (textoCloze) parcial.frente = removerMarcacaoCloze(textoCloze);
  }
  if (Object.keys(patch).some((campo) => campo !== 'ordem')) parcial.estado = 'editado';
  return parcial;
}

export function useRevisao(jobId: string, opcoes: OpcoesRevisao = {}) {
  const navegar = opcoes.navegar ?? ((url: string) => window.location.assign(url));
  const navegarRef = useRef(navegar);
  navegarRef.current = navegar;

  const [status, setStatus] = useState<StatusCarga>('carregando');
  const [erroCarga, setErroCarga] = useState<DescricaoErro | null>(null);
  const [job, setJob] = useState<JobResumo | null>(null);
  const [cards, setCards] = useState<CardRevisao[]>([]);
  const cardsRef = useRef<CardRevisao[]>([]);
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(new Set());
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set());
  const [mostrarDescartados, setMostrarDescartados] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaAdiada = useDeferredValue(busca);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer | null>(null);
  const [exportando, setExportando] = useState<ExportFormato | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const temporizadorAviso = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const temporizadorDesfazer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const desfazerRef = useRef<{ ids: string[]; anteriores: Map<string, CardRevisao['estado']> } | null>(null);
  const filaOrdem = useRef<Promise<void>>(Promise.resolve());
  const buscaRef = useRef(buscaAdiada);
  buscaRef.current = buscaAdiada;
  const mostrarDescartadosRef = useRef(mostrarDescartados);
  mostrarDescartadosRef.current = mostrarDescartados;

  /** Aplica a mudança de forma síncrona sobre a última lista, sem depender de closures antigas. */
  const atualizar = useCallback((fn: (lista: CardRevisao[]) => CardRevisao[]) => {
    cardsRef.current = fn(cardsRef.current);
    setCards(cardsRef.current);
  }, []);

  const anunciar = useCallback((texto: string, tipo: Aviso['tipo'] = 'info', extra: Partial<DescricaoErro> = {}) => {
    clearTimeout(temporizadorAviso.current);
    setAviso({ tipo, texto, ...extra });
    if (tipo === 'info') temporizadorAviso.current = setTimeout(() => setAviso(null), PRAZO_AVISO_MS);
  }, []);

  const falhar = useCallback(
    (erro: unknown, contexto: Parameters<typeof descreverErro>[1]) => {
      const descricao = descreverErro(erro, contexto, jobId);
      anunciar(descricao.texto, 'erro', descricao);
    },
    [anunciar, jobId],
  );

  const dispensarAviso = useCallback(() => {
    clearTimeout(temporizadorAviso.current);
    setAviso(null);
  }, []);

  // ─────────────── carga ───────────────

  useEffect(() => {
    let cancelado = false;
    setStatus('carregando');
    setErroCarga(null);
    (async () => {
      try {
        const resumo = await obterJob(jobId);
        if (cancelado) return;
        setJob(resumo);
        if (!ESTADOS_PRONTOS.includes(resumo.status)) {
          setStatus('job_pendente');
          return;
        }
        const todos: CardRevisao[] = [];
        for (let pagina = 1; ; pagina++) {
          const resposta = await listarCards(jobId, { pagina, tamanho: TAMANHO_PAGINA, incluirDescartados: true });
          todos.push(...resposta.cards);
          if (resposta.cards.length === 0 || todos.length >= resposta.total) break;
        }
        if (cancelado) return;
        cardsRef.current = todos;
        setCards(todos);
        setSelecionados(new Set());
        setStatus('pronto');
      } catch (erro) {
        if (cancelado) return;
        setErroCarga(descreverErro(erro, 'carregar', jobId));
        setStatus('erro');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [jobId, tentativa]);

  useEffect(
    () => () => {
      clearTimeout(temporizadorAviso.current);
      clearTimeout(temporizadorDesfazer.current);
    },
    [],
  );

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  // ─────────────── derivados ───────────────

  const secoes: Secao[] = useMemo(() => {
    const termo = normalizarBusca(buscaAdiada);
    const visiveis = cards.filter((card) => (mostrarDescartados || card.estado !== 'descartado') && cardCombinaBusca(card, termo));
    return agruparPorSecao(visiveis);
  }, [cards, mostrarDescartados, buscaAdiada]);

  const totais = useMemo(() => {
    const descartados = cards.filter((card) => card.estado === 'descartado').length;
    return { geral: cards.length, descartados, ativos: cards.length - descartados };
  }, [cards]);

  // ─────────────── seleção ───────────────

  const alternarSelecao = useCallback((id: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }, []);

  const removerDaSelecao = useCallback((ids: string[]) => {
    setSelecionados((atual) => {
      if (!ids.some((id) => atual.has(id))) return atual;
      const novo = new Set(atual);
      for (const id of ids) novo.delete(id);
      return novo;
    });
  }, []);

  // ─────────────── otimismo ───────────────

  /** Aplica um parcial a vários cards e devolve o rollback, que restaura apenas os campos alterados. */
  const aplicarParcial = useCallback(
    (ids: readonly string[], parcial: (card: CardRevisao) => Partial<CardRevisao>): (() => void) => {
      const alvo = new Set(ids);
      const antes = new Map<string, CardRevisao>();
      atualizar((lista) =>
        lista.map((card) => {
          if (!alvo.has(card.id)) return card;
          antes.set(card.id, card);
          return { ...card, ...parcial(card) };
        }),
      );
      return () =>
        atualizar((lista) =>
          lista.map((card) => {
            const original = antes.get(card.id);
            if (!original) return card;
            const revertido: Partial<CardRevisao> = {};
            for (const campo of Object.keys(parcial(original)) as Array<keyof CardRevisao>) {
              (revertido as Record<string, unknown>)[campo] = original[campo];
            }
            return { ...card, ...revertido };
          }),
        );
    },
    [atualizar],
  );

  const marcarOcupado = useCallback((id: string, ocupado: boolean) => {
    setOcupados((atual) => {
      if (atual.has(id) === ocupado) return atual;
      const novo = new Set(atual);
      if (ocupado) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }, []);

  // ─────────────── edição ───────────────

  const salvar = useCallback(
    async (id: string, patch: EditarCard): Promise<ResultadoSalvar> => {
      const atual = cardsRef.current.find((card) => card.id === id);
      if (!atual) return { ok: false, mensagem: 'Este card não existe mais.' };

      const tipoFinal = patch.tipo ?? atual.tipo;
      const textoClozeFinal = patch.textoCloze !== undefined ? patch.textoCloze : atual.textoCloze;
      if (tipoFinal === 'cloze' && (patch.textoCloze !== undefined || patch.tipo === 'cloze')) {
        const motivo = validarClozeLocal(textoClozeFinal);
        if (motivo) return { ok: false, motivo, mensagem: mensagemMotivoCloze(motivo) };
      }
      const corpo: EditarCard = tipoFinal === 'basico' && patch.tipo === 'basico' ? { ...patch, textoCloze: null } : patch;

      const reverter = aplicarParcial([id], (card) => patchOtimista(card, corpo));
      try {
        const resposta = await editarCard(id, corpo);
        atualizar((lista) => lista.map((card) => (card.id === id ? { ...card, ...resposta } : card)));
        anunciar('Alteração salva.');
        return { ok: true };
      } catch (erro) {
        reverter();
        const { mensagem, motivo } = mensagemErroSalvar(erro, textoClozeFinal, jobId);
        if (!motivo) anunciar(mensagem, 'erro');
        return { ok: false, mensagem, motivo };
      }
    },
    [anunciar, aplicarParcial, atualizar, jobId],
  );

  // ─────────────── descartar / restaurar ───────────────

  const oferecerDesfazer = useCallback((rotulo: string, ids: string[], anteriores: Map<string, CardRevisao['estado']>) => {
    clearTimeout(temporizadorDesfazer.current);
    desfazerRef.current = { ids, anteriores };
    setDesfazer({ rotulo, ids });
    temporizadorDesfazer.current = setTimeout(() => {
      desfazerRef.current = null;
      setDesfazer(null);
    }, PRAZO_DESFAZER_MS);
  }, []);

  const descartarIds = useCallback(
    async (ids: string[]) => {
      const alvos = cardsRef.current.filter((card) => ids.includes(card.id) && card.estado !== 'descartado');
      if (alvos.length === 0) return;
      const alvoIds = alvos.map((card) => card.id);
      const anteriores = new Map(alvos.map((card) => [card.id, card.estado]));
      const reverter = aplicarParcial(alvoIds, () => ({ estado: 'descartado' }));
      removerDaSelecao(alvoIds);
      try {
        if (alvoIds.length === 1) await descartarCard(alvoIds[0]);
        else await cardsEmLote(alvoIds, 'descartar');
        oferecerDesfazer(alvoIds.length === 1 ? 'Card descartado.' : `${alvoIds.length} cards descartados.`, alvoIds, anteriores);
      } catch (erro) {
        reverter();
        falhar(erro, alvoIds.length === 1 ? 'descartar' : 'lote');
      }
    },
    [aplicarParcial, falhar, oferecerDesfazer, removerDaSelecao],
  );

  const restaurarIds = useCallback(
    async (ids: string[]) => {
      const alvos = cardsRef.current.filter((card) => ids.includes(card.id) && card.estado === 'descartado');
      if (alvos.length === 0) return;
      const alvoIds = alvos.map((card) => card.id);
      const reverter = aplicarParcial(alvoIds, (card) => ({ estado: card.estado === 'descartado' ? 'editado' : card.estado }));
      try {
        await cardsEmLote(alvoIds, 'restaurar');
        anunciar(alvoIds.length === 1 ? 'Card restaurado.' : `${alvoIds.length} cards restaurados.`);
      } catch (erro) {
        reverter();
        falhar(erro, alvoIds.length === 1 ? 'restaurar' : 'lote');
      }
    },
    [anunciar, aplicarParcial, falhar],
  );

  const desfazerUltimoDescarte = useCallback(async () => {
    const pendente = desfazerRef.current;
    if (!pendente) return;
    clearTimeout(temporizadorDesfazer.current);
    desfazerRef.current = null;
    setDesfazer(null);
    const reverter = aplicarParcial(pendente.ids, (card) => ({ estado: pendente.anteriores.get(card.id) ?? 'editado' }));
    try {
      await cardsEmLote(pendente.ids, 'restaurar');
      anunciar(pendente.ids.length === 1 ? 'Descarte desfeito.' : `${pendente.ids.length} cards restaurados.`);
    } catch (erro) {
      reverter();
      falhar(erro, 'restaurar');
    }
  }, [anunciar, aplicarParcial, falhar]);

  // ─────────────── regenerar ───────────────

  const regenerar = useCallback(
    async (id: string) => {
      marcarOcupado(id, true);
      try {
        const novo = await regenerarCard(id);
        atualizar((lista) => {
          const indice = lista.findIndex((card) => card.id === id);
          if (indice < 0) return lista;
          const copia = [...lista];
          copia.splice(indice, 1, novo, { ...lista[indice], estado: 'descartado' });
          return copia;
        });
        removerDaSelecao([id]);
        anunciar('Card regenerado. O original foi descartado e pode ser restaurado.');
      } catch (erro) {
        falhar(erro, 'regenerar');
      } finally {
        marcarOcupado(id, false);
      }
    },
    [anunciar, atualizar, falhar, marcarOcupado, removerDaSelecao],
  );

  // ─────────────── ordem ───────────────

  const mover = useCallback(
    (id: string, direcao: -1 | 1) => {
      const lista = cardsRef.current;
      const card = lista.find((c) => c.id === id);
      if (!card) return;
      const secao = agruparPorSecao(lista).find((s) => s.cards.some((c) => c.id === id));
      if (!secao) return;
      const termo = normalizarBusca(buscaRef.current);
      const visiveis = secao.cards.filter(
        (c) => (mostrarDescartadosRef.current || c.estado !== 'descartado' || c.id === id) && cardCombinaBusca(c, termo),
      );
      const posicao = visiveis.findIndex((c) => c.id === id);
      const vizinho = visiveis[posicao + direcao];
      if (!vizinho) return;

      const trocar = (a: string, b: string) =>
        atualizar((l) => {
          const i = l.findIndex((c) => c.id === a);
          const j = l.findIndex((c) => c.id === b);
          if (i < 0 || j < 0) return l;
          const copia = [...l];
          [copia[i], copia[j]] = [copia[j], copia[i]];
          return copia;
        });
      trocar(id, vizinho.id);
      anunciar(`Card movido para a posição ${posicao + direcao + 1} de ${visiveis.length} na seção "${secao.titulo}".`);

      // Envia a ordem completa do baralho: a API põe os ids informados na frente dos demais.
      filaOrdem.current = filaOrdem.current.then(async () => {
        try {
          await reordenarCards(jobId, cardsRef.current.map((c) => c.id));
        } catch (erro) {
          trocar(id, vizinho.id);
          falhar(erro, 'ordenar');
        }
      });
    },
    [anunciar, atualizar, falhar, jobId],
  );
  // ─────────────── lote de tags ───────────────

  const alterarTags = useCallback(
    async (ids: string[], tag: string, acao: 'adicionarTags' | 'removerTags') => {
      const limpa = normalizarTag(tag);
      if (limpa === '' || ids.length === 0) return;
      const reverter = aplicarParcial(ids, (card) => ({
        tags: acao === 'adicionarTags' ? tagsUnicas([...card.tags, limpa]) : card.tags.filter((t) => t !== limpa),
      }));
      try {
        await cardsEmLote(ids, acao, [limpa]);
        anunciar(acao === 'adicionarTags' ? `Tag "${limpa}" adicionada a ${ids.length} card(s).` : `Tag "${limpa}" removida de ${ids.length} card(s).`);
      } catch (erro) {
        reverter();
        falhar(erro, 'lote');
      }
    },
    [anunciar, aplicarParcial, falhar],
  );

  const selecionadosRef = useRef(selecionados);
  selecionadosRef.current = selecionados;

  const idsSelecionados = useCallback(() => cardsRef.current.filter((card) => selecionadosRef.current.has(card.id)), []);

  const acoes: AcoesCard = useMemo(
    () => ({
      salvar,
      descartar: (id) => void descartarIds([id]),
      restaurar: (id) => void restaurarIds([id]),
      regenerar: (id) => void regenerar(id),
      mover,
      alternarSelecao,
    }),
    [alternarSelecao, descartarIds, mover, regenerar, restaurarIds, salvar],
  );

  const selecao: AcoesSelecao = useMemo(
    () => ({
      alternarSecao: (ids, marcar) =>
        setSelecionados((atual) => {
          const novo = new Set(atual);
          for (const id of ids) {
            if (marcar) novo.add(id);
            else novo.delete(id);
          }
          return novo;
        }),
      limpar: () => setSelecionados(new Set()),
      descartar: () => void descartarIds(idsSelecionados().filter((c) => c.estado !== 'descartado').map((c) => c.id)),
      restaurar: () => void restaurarIds(idsSelecionados().filter((c) => c.estado === 'descartado').map((c) => c.id)),
      adicionarTag: (tag) => void alterarTags(idsSelecionados().map((c) => c.id), tag, 'adicionarTags'),
      removerTag: (tag) => void alterarTags(idsSelecionados().map((c) => c.id), tag, 'removerTags'),
      tagearIds: (ids, tag) => void alterarTags(ids, tag, 'adicionarTags'),
    }),
    [alterarTags, descartarIds, idsSelecionados, restaurarIds],
  );

  // ─────────────── exportação ───────────────

  const exportar = useCallback(
    async (formato: ExportFormato) => {
      if (exportando) return;
      setExportando(formato);
      try {
        const criada = await criarExportacao({ jobId, formato });
        anunciar('Exportação pronta. O download vai começar.');
        navegarRef.current(urlDownload(criada.id));
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) {
          anunciar('Para exportar é preciso entrar na sua conta. Redirecionando...', 'erro');
          navegarRef.current(hrefEntrar(jobId));
        } else {
          falhar(erro, 'exportar');
        }
      } finally {
        setExportando(null);
      }
    },
    [anunciar, exportando, falhar, jobId],
  );

  return {
    status,
    erroCarga,
    job,
    cards,
    secoes,
    totais,
    selecionados,
    ocupados,
    mostrarDescartados,
    setMostrarDescartados,
    busca,
    setBusca,
    aviso,
    dispensarAviso,
    desfazer,
    desfazerUltimoDescarte,
    exportando,
    exportar,
    acoes,
    selecao,
    recarregar,
  };
}

export type Revisao = ReturnType<typeof useRevisao>;
