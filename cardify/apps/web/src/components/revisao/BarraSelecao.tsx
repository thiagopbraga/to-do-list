'use client';

import { useState, type FormEvent } from 'react';
import { BOTAO_LEVE, BOTAO_PERIGO, BOTAO_SECUNDARIO, CAMPO } from './estilos';
import type { AcoesSelecao } from './useRevisao';

interface Props {
  quantidade: number;
  descartaveis: number;
  restauraveis: number;
  selecao: AcoesSelecao;
}

export function BarraSelecao({ quantidade, descartaveis, restauraveis, selecao }: Props) {
  const [tag, setTag] = useState('');
  const semTag = tag.trim() === '';

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!semTag) selecao.adicionarTag(tag);
  };

  return (
    <div role="region" aria-label="Ações para os cards selecionados" className="sticky top-0 z-10 rounded-lg border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-medium text-indigo-950">
          {quantidade} {quantidade === 1 ? 'card selecionado' : 'cards selecionados'}
        </p>
        <button type="button" className={BOTAO_PERIGO} disabled={descartaveis === 0} onClick={selecao.descartar}>
          Descartar ({descartaveis})
        </button>
        <button type="button" className={BOTAO_SECUNDARIO} disabled={restauraveis === 0} onClick={selecao.restaurar}>
          Restaurar ({restauraveis})
        </button>
        <button type="button" className={BOTAO_LEVE} onClick={selecao.limpar}>
          Limpar seleção
        </button>
      </div>
      <form onSubmit={enviar} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={tag}
          maxLength={60}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Tag"
          aria-label="Tag para adicionar ou remover dos cards selecionados"
          className={`min-w-0 flex-1 sm:w-48 sm:flex-none ${CAMPO}`}
        />
        <button type="submit" className={BOTAO_SECUNDARIO} disabled={semTag}>
          Adicionar tag
        </button>
        <button type="button" className={BOTAO_SECUNDARIO} disabled={semTag} onClick={() => selecao.removerTag(tag)}>
          Remover tag
        </button>
      </form>
    </div>
  );
}
