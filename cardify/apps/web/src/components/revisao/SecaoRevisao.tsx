'use client';

import { memo, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CartaoRevisao } from './CartaoRevisao';
import { BOTAO_SECUNDARIO, CAMPO, FOCO } from './estilos';
import type { AcoesCard, AcoesSelecao } from './useRevisao';
import type { Secao } from './utilitarios';

interface Props {
  secao: Secao;
  selecionados: ReadonlySet<string>;
  ocupados: ReadonlySet<string>;
  acoes: AcoesCard;
  selecao: AcoesSelecao;
}

export const SecaoRevisao = memo(function SecaoRevisao({ secao, selecionados, ocupados, acoes, selecao }: Props) {
  const idTitulo = useId();
  const marcador = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState('');

  const ids = secao.cards.map((card) => card.id);
  const marcados = ids.filter((id) => selecionados.has(id)).length;
  const todos = ids.length > 0 && marcados === ids.length;

  useEffect(() => {
    if (marcador.current) marcador.current.indeterminate = marcados > 0 && !todos;
  }, [marcados, todos]);

  const aplicarTag = (evento: FormEvent) => {
    evento.preventDefault();
    const ativos = secao.cards.filter((card) => card.estado !== 'descartado').map((card) => card.id);
    if (tag.trim() === '' || ativos.length === 0) return;
    selecao.tagearIds(ativos, tag);
    setTag('');
  };

  return (
    <section aria-labelledby={idTitulo} className="space-y-3">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 pb-2">
        <label className="flex min-h-8 items-center gap-2 text-sm text-slate-700">
          <input
            ref={marcador}
            type="checkbox"
            checked={todos}
            onChange={() => selecao.alternarSecao(ids, !todos)}
            aria-label={`Selecionar todos os cards da seção ${secao.titulo}`}
            className={`size-4 accent-indigo-600 ${FOCO}`}
          />
          <span className="sr-only sm:not-sr-only">Selecionar todos</span>
        </label>
        <h2 id={idTitulo} className="min-w-0 flex-1 break-words text-base font-semibold text-slate-900">
          {secao.titulo}
          <span className="ml-2 text-sm font-normal text-slate-500">
            {ids.length} {ids.length === 1 ? 'card' : 'cards'}
          </span>
        </h2>
        <form onSubmit={aplicarTag} className="flex items-center gap-2">
          <input
            type="text"
            value={tag}
            maxLength={60}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Tag para a seção"
            aria-label={`Tag para todos os cards ativos da seção ${secao.titulo}`}
            className={`w-36 sm:w-44 ${CAMPO}`}
          />
          <button type="submit" className={BOTAO_SECUNDARIO} disabled={tag.trim() === ''}>
            Aplicar
          </button>
        </form>
      </header>
      <ul className="space-y-3">
        {secao.cards.map((card, indice) => (
          <li key={card.id}>
            <CartaoRevisao
              card={card}
              selecionado={selecionados.has(card.id)}
              ocupado={ocupados.has(card.id)}
              indice={indice}
              podeSubir={indice > 0}
              podeDescer={indice < secao.cards.length - 1}
              acoes={acoes}
            />
          </li>
        ))}
      </ul>
    </section>
  );
});
