import { CLOZE_REGEX, type CardRevisao } from '@cardify/shared';

interface Parte {
  oclusao: boolean;
  texto: string;
}

/** Quebra o texto de cloze (`{{c1::texto::dica}}`) em trechos normais e oclusões. */
export function partesCloze(textoCloze: string): Parte[] {
  const partes: Parte[] = [];
  let cursor = 0;
  for (const ocorrencia of textoCloze.matchAll(CLOZE_REGEX)) {
    const inicio = ocorrencia.index ?? 0;
    if (inicio > cursor) partes.push({ oclusao: false, texto: textoCloze.slice(cursor, inicio) });
    partes.push({ oclusao: true, texto: ocorrencia[2] });
    cursor = inicio + ocorrencia[0].length;
  }
  if (cursor < textoCloze.length) partes.push({ oclusao: false, texto: textoCloze.slice(cursor) });
  return partes;
}

const ESTILO_OCLUSAO = 'rounded bg-indigo-100 px-1 font-semibold text-indigo-900';

export function CartaoGerado({ card }: { card: CardRevisao }) {
  const partes = card.tipo === 'cloze' && card.textoCloze ? partesCloze(card.textoCloze) : null;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {partes ? 'Cloze' : 'Básico'}
      </span>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-medium text-slate-500">Frente</p>
          <p className="mt-1 break-words text-slate-900">
            {partes
              ? partes.map((parte, indice) =>
                  parte.oclusao ? (
                    <span key={indice} className={ESTILO_OCLUSAO}>
                      [...]
                    </span>
                  ) : (
                    <span key={indice}>{parte.texto}</span>
                  ),
                )
              : card.frente}
          </p>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">Verso</p>
          <p className="mt-1 break-words text-slate-900">
            {partes
              ? partes.map((parte, indice) =>
                  parte.oclusao ? (
                    <span key={indice} className={ESTILO_OCLUSAO}>
                      {parte.texto}
                    </span>
                  ) : (
                    <span key={indice}>{parte.texto}</span>
                  ),
                )
              : card.verso}
          </p>
        </div>
      </div>
    </li>
  );
}
