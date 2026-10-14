'use client';

import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CardRevisao } from '@cardify/shared';
import { ChipsTags } from './ChipsTags';
import { EditorTexto } from './EditorTexto';
import { PreviaCloze } from './PreviaCloze';
import { BOTAO_LEVE, FOCO } from './estilos';
import type { AcoesCard } from './useRevisao';
import { respostasCloze } from './utilitarios';

type Campo = 'frente' | 'verso' | 'cloze';

interface Props {
  card: CardRevisao;
  selecionado: boolean;
  ocupado: boolean;
  indice: number;
  podeSubir: boolean;
  podeDescer: boolean;
  acoes: AcoesCard;
}

function resumo(texto: string): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length > 60 ? `${limpo.slice(0, 57)}...` : limpo;
}

function Rotulo({ children }: { children: ReactNode }) {
  return <span className="mb-0.5 block px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">{children}</span>;
}

function TextoClicavel({ rotulo, aoClicar, desabilitado, children }: { rotulo: string; aoClicar(): void; desabilitado: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      className={`block w-full whitespace-pre-wrap break-words rounded-md px-2 py-1 text-left text-sm text-slate-900 enabled:hover:bg-slate-100 ${FOCO}`}
    >
      <span className="sr-only">Editar {rotulo}: </span>
      {children}
    </button>
  );
}

export const CartaoRevisao = memo(function CartaoRevisao({ card, selecionado, ocupado, indice, podeSubir, podeDescer, acoes }: Props) {
  const [editando, setEditando] = useState<Campo | null>(null);
  const raiz = useRef<HTMLElement>(null);
  const botaoSubir = useRef<HTMLButtonElement>(null);
  const botaoDescer = useRef<HTMLButtonElement>(null);
  const ultimoMover = useRef<-1 | 1 | null>(null);

  const descartado = card.estado === 'descartado';
  const cloze = card.tipo === 'cloze';
  const bloqueado = descartado || ocupado;

  // Mover o card reordena o DOM e pode tirar o foco do botão; devolve o foco ao botão usado.
  useLayoutEffect(() => {
    const direcao = ultimoMover.current;
    if (direcao === null) return;
    ultimoMover.current = null;
    if (raiz.current?.contains(document.activeElement)) return;
    const preferido = direcao === -1 ? botaoSubir.current : botaoDescer.current;
    const alternativo = direcao === -1 ? botaoDescer.current : botaoSubir.current;
    (preferido && !preferido.disabled ? preferido : alternativo)?.focus();
  }, [indice]);

  const mover = (direcao: -1 | 1) => {
    ultimoMover.current = direcao;
    acoes.mover(card.id, direcao);
  };

  const encerrar = () => setEditando(null);

  const trocarTipo = async () => {
    if (cloze) {
      const resultado = await acoes.salvar(card.id, { tipo: 'basico', textoCloze: null });
      if (resultado.ok) setEditando(card.frente.trim() === '' ? 'frente' : card.verso.trim() === '' ? 'verso' : 'frente');
    } else {
      setEditando('cloze');
    }
  };

  const salvarCampo = (campo: Campo) => (valor: string) => {
    if (campo === 'cloze') return acoes.salvar(card.id, cloze ? { textoCloze: valor } : { tipo: 'cloze', textoCloze: valor });
    return acoes.salvar(card.id, campo === 'frente' ? { frente: valor } : { verso: valor });
  };

  const sementeCloze = card.textoCloze ?? card.frente;

  return (
    <article
      ref={raiz}
      aria-label={`Card: ${resumo(card.frente)}`}
      aria-busy={ocupado}
      className={`rounded-lg border bg-white p-3 [contain-intrinsic-size:auto_190px] [content-visibility:auto] sm:p-4 ${
        selecionado ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'
      } ${descartado ? 'bg-slate-50 opacity-70' : ''}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <label className="flex min-h-8 items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={selecionado}
            onChange={() => acoes.alternarSelecao(card.id)}
            aria-label={`Selecionar o card: ${resumo(card.frente)}`}
            className={`size-4 accent-indigo-600 ${FOCO}`}
          />
          <span className={`rounded-full px-2 py-0.5 ${cloze ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>
            {cloze ? 'Cloze' : 'Básico'}
          </span>
        </label>
        {card.estado === 'editado' && <span className="text-xs text-slate-500">Editado</span>}
        {descartado && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Descartado</span>}
        {ocupado && <span className="text-xs text-indigo-700">Regenerando...</span>}
        <span className="ml-auto flex items-center">
          <button
            ref={botaoSubir}
            type="button"
            className={BOTAO_LEVE}
            disabled={!podeSubir || bloqueado}
            onClick={() => mover(-1)}
            aria-label={`Mover para cima o card: ${resumo(card.frente)}`}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            ref={botaoDescer}
            type="button"
            className={BOTAO_LEVE}
            disabled={!podeDescer || bloqueado}
            onClick={() => mover(1)}
            aria-label={`Mover para baixo o card: ${resumo(card.frente)}`}
          >
            <span aria-hidden="true">↓</span>
          </button>
        </span>
      </div>

      {editando === 'cloze' ? (
        <div>
          <Rotulo>Texto cloze</Rotulo>
          <EditorTexto rotulo="o texto cloze" cloze valorInicial={sementeCloze} aoSalvar={salvarCampo('cloze')} aoEncerrar={encerrar} />
        </div>
      ) : cloze && card.textoCloze ? (
        <div>
          <Rotulo>Texto cloze</Rotulo>
          <TextoClicavel rotulo="o texto cloze" aoClicar={() => setEditando('cloze')} desabilitado={bloqueado}>
            <PreviaCloze texto={card.textoCloze} />
          </TextoClicavel>
          <p className="mt-1 px-2 text-xs text-slate-600">Respostas: {respostasCloze(card.textoCloze).join(' · ')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <Rotulo>Frente</Rotulo>
            {editando === 'frente' ? (
              <EditorTexto rotulo="a frente" valorInicial={card.frente} maxLength={300} aoSalvar={salvarCampo('frente')} aoEncerrar={encerrar} />
            ) : (
              <TextoClicavel rotulo="a frente" aoClicar={() => setEditando('frente')} desabilitado={bloqueado}>
                {card.frente}
              </TextoClicavel>
            )}
          </div>
          <div>
            <Rotulo>Verso</Rotulo>
            {editando === 'verso' ? (
              <EditorTexto rotulo="o verso" valorInicial={card.verso} maxLength={500} aoSalvar={salvarCampo('verso')} aoEncerrar={encerrar} />
            ) : (
              <TextoClicavel rotulo="o verso" aoClicar={() => setEditando('verso')} desabilitado={bloqueado}>
                {card.verso}
              </TextoClicavel>
            )}
          </div>
        </div>
      )}

      <div className="mt-3">
        <ChipsTags tags={card.tags} desabilitado={bloqueado} aoAlterar={(tags) => void acoes.salvar(card.id, { tags })} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
        {descartado ? (
          <button type="button" className={BOTAO_LEVE} onClick={() => acoes.restaurar(card.id)} aria-label={`Restaurar o card: ${resumo(card.frente)}`}>
            Restaurar
          </button>
        ) : (
          <>
            <button
              type="button"
              className={BOTAO_LEVE}
              disabled={ocupado}
              onClick={() => void trocarTipo()}
              aria-label={cloze ? 'Trocar este card para o tipo básico' : 'Trocar este card para o tipo cloze'}
            >
              {cloze ? 'Trocar para básico' : 'Trocar para cloze'}
            </button>
            <button
              type="button"
              className={BOTAO_LEVE}
              disabled={ocupado}
              onClick={() => acoes.regenerar(card.id)}
              aria-label={`Regenerar o card: ${resumo(card.frente)}`}
            >
              {ocupado ? 'Regenerando...' : 'Regenerar'}
            </button>
            <button
              type="button"
              className={`${BOTAO_LEVE} text-red-700 hover:bg-red-50`}
              disabled={ocupado}
              onClick={() => acoes.descartar(card.id)}
              aria-label={`Descartar o card: ${resumo(card.frente)}`}
            >
              Descartar
            </button>
          </>
        )}
      </div>
    </article>
  );
});
