import { memo } from 'react';
import { partesCloze } from './utilitarios';

/** Texto cloze com as oclusões destacadas. */
export const PreviaCloze = memo(function PreviaCloze({ texto }: { texto: string }) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {partesCloze(texto).map((parte, i) =>
        parte.oclusao ? (
          <mark key={i} className="rounded bg-amber-200 px-1 text-amber-950" title={parte.oclusao.dica ? `Dica: ${parte.oclusao.dica}` : undefined}>
            <sup className="mr-0.5 text-[10px] font-semibold">c{parte.oclusao.indice}</sup>
            {parte.texto}
          </mark>
        ) : (
          <span key={i}>{parte.texto}</span>
        ),
      )}
    </span>
  );
});
