import { PLANOS, type Plano } from '@cardify/shared';
import { formatarInteiro, formatarPreco, formatarPrecoDiluido } from '../../lib/documentos';

interface Props {
  plano: Plano;
  recomendado?: boolean;
  atual?: boolean;
  bloqueado?: boolean;
  economia?: string;
  aoEscolher?: () => void;
}

export function CartaoPlano({ plano, recomendado = false, atual = false, bloqueado = false, economia, aoEscolher }: Props) {
  const definicao = PLANOS[plano];
  const id = `plano-${plano}`;
  const gratis = definicao.precoCentavos === 0;

  const precoPrincipal = gratis
    ? 'Grátis'
    : `${formatarPreco(definicao.precoCentavos)}${definicao.periodicidade === 'anual' ? '/ano' : '/mês'}`;

  const beneficios = [
    `${formatarInteiro(definicao.cotaCardsMes)} cards por mês`,
    ...(definicao.ocr ? ['OCR para PDFs escaneados'] : []),
    ...(definicao.questoes ? ['Geração de questões'] : []),
  ];

  const destacado = recomendado || atual;

  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col rounded-2xl border bg-white p-5 ${destacado ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold text-slate-900">
          {definicao.nome}
        </h2>
        {atual && <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white">Seu plano</span>}
        {!atual && recomendado && (
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">Recomendado</span>
        )}
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-900">{precoPrincipal}</p>
      {definicao.periodicidade === 'anual' && (
        <p className="text-sm text-slate-600">Equivale a {formatarPrecoDiluido(definicao.precoCentavos, 12)}/mês</p>
      )}
      {economia && <p className="mt-1 text-sm font-medium text-emerald-700">{economia}</p>}

      <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
        {beneficios.map((texto) => (
          <li key={texto} className="flex gap-2">
            <span aria-hidden="true" className="text-indigo-600">✓</span>
            <span>{texto}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {gratis ? (
          <p className="text-center text-sm text-slate-500">{atual ? 'Você está no plano gratuito.' : 'Plano gratuito.'}</p>
        ) : atual ? (
          <p className="text-center text-sm font-medium text-slate-700">Este é o seu plano atual.</p>
        ) : (
          <button
            type="button"
            onClick={aoEscolher}
            disabled={bloqueado || !aoEscolher}
            aria-describedby={bloqueado ? `${id}-bloqueado` : undefined}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Assinar {definicao.nome}
          </button>
        )}
        {bloqueado && !atual && !gratis && (
          <p id={`${id}-bloqueado`} className="mt-2 text-center text-xs text-slate-500">
            Indisponível enquanto houver uma assinatura ativa.
          </p>
        )}
      </div>
    </section>
  );
}
