export const FOCO =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 focus-visible:outline-solid';

const BOTAO = `inline-flex min-h-9 items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCO}`;

export const BOTAO_PRIMARIO = `${BOTAO} bg-indigo-600 text-white hover:bg-indigo-700`;
export const BOTAO_SECUNDARIO = `${BOTAO} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
export const BOTAO_PERIGO = `${BOTAO} border border-red-300 bg-white text-red-700 hover:bg-red-50`;
export const BOTAO_LEVE = `inline-flex min-h-8 items-center justify-center rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`;
export const CAMPO = `rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 ${FOCO}`;
