'use client';

import type { ExportFormato } from '@cardify/shared';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from './estilos';

interface Props {
  totalAtivos: number;
  exportando: ExportFormato | null;
  aoExportar(formato: ExportFormato): void;
}

const AJUDA_APKG = 'O .apkg importa direto no Anki (desktop e AnkiDroid). Reimportar não duplica: cards editados são atualizados.';
const AJUDA_TABELA = 'O CSV/TSV usa os tipos de nota do Cardify: importe um .apkg do Cardify uma vez antes.';

export function BarraExportacao({ totalAtivos, exportando, aoExportar }: Props) {
  const indisponivel = totalAtivos === 0 || exportando !== null;
  return (
    <div className="border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm font-medium text-slate-900">
            {totalAtivos} {totalAtivos === 1 ? 'card ativo' : 'cards ativos'}
          </p>
          <button type="button" className={BOTAO_PRIMARIO} disabled={indisponivel} onClick={() => aoExportar('apkg')} aria-label="Exportar em formato .apkg para o Anki">
            {exportando === 'apkg' ? 'Exportando...' : 'Exportar .apkg'}
          </button>
          <button type="button" className={BOTAO_SECUNDARIO} disabled={indisponivel} onClick={() => aoExportar('csv')} aria-label="Exportar em formato CSV">
            {exportando === 'csv' ? 'Exportando...' : 'CSV'}
          </button>
          <button type="button" className={BOTAO_SECUNDARIO} disabled={indisponivel} onClick={() => aoExportar('tsv')} aria-label="Exportar em formato TSV">
            {exportando === 'tsv' ? 'Exportando...' : 'TSV'}
          </button>
        </div>
        <div className="hidden space-y-0.5 text-xs text-slate-600 sm:block">
          <p>{AJUDA_APKG}</p>
          <p>{AJUDA_TABELA}</p>
        </div>
        <details className="text-xs text-slate-600 sm:hidden">
          <summary className="cursor-pointer py-1 font-medium">Ajuda sobre a exportação</summary>
          <div className="space-y-1 pt-1">
            <p>{AJUDA_APKG}</p>
            <p>{AJUDA_TABELA}</p>
          </div>
        </details>
      </div>
    </div>
  );
}
