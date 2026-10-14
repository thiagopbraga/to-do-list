import { formatarData, formatarInteiro } from '../../lib/documentos';

interface Props {
  confirmados: number;
  reservados: number;
  limite: number;
  restante: number;
  periodoFim: string;
}

export function BarraCota({ confirmados, reservados, limite, restante, periodoFim }: Props) {
  const usados = confirmados + reservados;
  const percentual = limite > 0 ? Math.min(100, Math.round((usados / limite) * 100)) : 0;
  const renova = formatarData(periodoFim);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="text-slate-800">
          <span className="font-semibold">{formatarInteiro(usados)}</span> de {formatarInteiro(limite)} cards usados neste mês
        </p>
        <p className="text-slate-600">{formatarInteiro(restante)} restantes</p>
      </div>
      <div
        role="progressbar"
        aria-label="Uso da cota mensal de cards"
        aria-valuemin={0}
        aria-valuemax={limite}
        aria-valuenow={Math.min(usados, limite)}
        aria-valuetext={`${percentual}% da cota usada`}
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-300" style={{ width: `${percentual}%` }} />
      </div>
      {renova && <p className="text-xs text-slate-500">A cota renova em {renova}.</p>}
    </div>
  );
}
