import type { JobStatus } from '@cardify/shared';

const ROTULO_ESTAGIO: Record<JobStatus, string> = {
  pendente: 'Na fila',
  ingerindo: 'Lendo o material',
  gerando: 'Escrevendo os cards',
  empacotando: 'Montando o baralho',
  concluido: 'Pronto',
  parcial: 'Pronto com ressalvas',
  falhou: 'Não foi possível concluir',
};

interface Props {
  status: JobStatus;
  percentual: number;
  cardsGerados: number;
}

export function Progresso({ status, percentual, cardsGerados }: Props) {
  const valor = Math.round(Math.min(100, Math.max(0, percentual)));
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p id="estagio-geracao" className="font-medium text-slate-800">
          {ROTULO_ESTAGIO[status]}…
        </p>
        <p className="text-sm text-slate-600">
          {cardsGerados} {cardsGerados === 1 ? 'card gerado' : 'cards gerados'}
        </p>
      </div>
      <div
        role="progressbar"
        aria-labelledby="estagio-geracao"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valor}
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full bg-indigo-600 transition-[width] duration-500" style={{ width: `${valor}%` }} />
      </div>
    </div>
  );
}
