'use client';

import { memo, useState, type KeyboardEvent } from 'react';
import { CAMPO, FOCO } from './estilos';
import { normalizarTag } from './utilitarios';

interface Props {
  tags: readonly string[];
  desabilitado?: boolean;
  aoAlterar(tags: string[]): void;
}

export const ChipsTags = memo(function ChipsTags({ tags, desabilitado = false, aoAlterar }: Props) {
  const [nova, setNova] = useState('');

  const adicionar = () => {
    const tag = normalizarTag(nova);
    setNova('');
    if (tag === '' || tags.includes(tag)) return;
    aoAlterar([...tags, tag]);
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter' && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      adicionar();
    }
  };

  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2.5 pr-1 text-xs text-indigo-900">
          <span className="break-all">{tag}</span>
          <button
            type="button"
            disabled={desabilitado}
            aria-label={`Remover a tag ${tag}`}
            onClick={() => aoAlterar(tags.filter((t) => t !== tag))}
            className={`inline-flex size-5 items-center justify-center rounded-full hover:bg-indigo-100 disabled:opacity-40 ${FOCO}`}
          >
            <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
      <li>
        <input
          type="text"
          value={nova}
          disabled={desabilitado}
          maxLength={60}
          placeholder="+ tag"
          aria-label="Adicionar tag"
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={aoTeclar}
          onBlur={adicionar}
          className={`w-24 py-0.5! text-xs ${CAMPO}`}
        />
      </li>
    </ul>
  );
});
