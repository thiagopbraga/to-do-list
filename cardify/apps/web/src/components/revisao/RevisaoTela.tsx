'use client';

import Link from 'next/link';
import { SecaoRevisao } from './SecaoRevisao';
import { BarraExportacao } from './BarraExportacao';
import { BarraSelecao } from './BarraSelecao';
import { BOTAO_LEVE, BOTAO_SECUNDARIO, CAMPO, FOCO } from './estilos';
import { useRevisao } from './useRevisao';

export function RevisaoTela({ jobId }: { jobId: string }) {
  const r = useRevisao(jobId);
  const { status, job, secoes, totais, selecionados, aviso, desfazer } = r;

  const selecionadosCards = r.cards.filter((card) => selecionados.has(card.id));
  const descartaveis = selecionadosCards.filter((card) => card.estado !== 'descartado').length;
  const restauraveis = selecionadosCards.length - descartaveis;

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 pb-72 pt-6 sm:pb-56">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Revisar cards</h1>
        {job?.nome && <p className="break-words text-sm text-slate-600">{job.nome}</p>}
        {status === 'pronto' && (
          <p className="text-xs text-slate-500">
            {totais.descartados} de {totais.geral} cards descartados
          </p>
        )}
      </header>

      {status === 'carregando' && (
        <p role="status" className="text-sm text-slate-600">
          Carregando os cards...
        </p>
      )}

      {status === 'erro' && r.erroCarga && (
        <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p>{r.erroCarga.texto}</p>
          <div className="flex gap-2">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={r.recarregar}>
              Tentar novamente
            </button>
            {r.erroCarga.href && (
              <Link href={r.erroCarga.href} className={`${BOTAO_SECUNDARIO} no-underline`}>
                {r.erroCarga.rotuloLink ?? 'Entrar'}
              </Link>
            )}
          </div>
        </div>
      )}

      {status === 'job_pendente' && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {job?.status === 'falhou'
            ? 'A geração deste baralho falhou. Acompanhe os detalhes na página de geração.'
            : 'A geração deste baralho ainda não terminou. A revisão fica disponível quando ela concluir.'}{' '}
          <Link href={`/gerar/${jobId}`} className="font-medium underline">
            Acompanhar a geração
          </Link>
        </div>
      )}

      {status === 'pronto' && (
        <>
          {job?.status === 'parcial' && (
            <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              A geração parou antes do fim (orçamento atingido); os cards abaixo estão prontos para uso.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <input
              type="search"
              value={r.busca}
              onChange={(e) => r.setBusca(e.target.value)}
              placeholder="Buscar nos cards"
              aria-label="Buscar nos cards por texto ou tag"
              className={`min-w-0 flex-1 sm:max-w-sm ${CAMPO}`}
            />
            <label className="flex min-h-8 items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={r.mostrarDescartados}
                onChange={(e) => r.setMostrarDescartados(e.target.checked)}
                className={`size-4 accent-indigo-600 ${FOCO}`}
              />
              Mostrar descartados ({totais.descartados})
            </label>
          </div>

          {selecionados.size > 0 && (
            <BarraSelecao quantidade={selecionados.size} descartaveis={descartaveis} restauraveis={restauraveis} selecao={r.selecao} />
          )}

          {secoes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
              {r.cards.length === 0
                ? 'Este baralho não tem cards.'
                : r.busca.trim() !== ''
                  ? 'Nenhum card corresponde à busca.'
                  : 'Todos os cards foram descartados. Ative "Mostrar descartados" para restaurá-los.'}
            </p>
          ) : (
            <div className="space-y-8">
              {secoes.map((secao) => (
                <SecaoRevisao key={secao.chave} secao={secao} selecionados={selecionados} ocupados={r.ocupados} acoes={r.acoes} selecao={r.selecao} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 pb-2">
          <div aria-live="polite" aria-atomic="true" className="flex flex-col items-start gap-2">
            {aviso?.tipo === 'info' && <p className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">{aviso.texto}</p>}
            {desfazer && (
              <p className="flex items-center gap-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">
                <span>{desfazer.rotulo}</span>
                <button
                  type="button"
                  onClick={() => void r.desfazerUltimoDescarte()}
                  className={`rounded px-2 py-1 font-semibold text-indigo-200 underline hover:text-white ${FOCO}`}
                >
                  Desfazer
                </button>
              </p>
            )}
          </div>
          <div aria-live="assertive" aria-atomic="true">
            {aviso?.tipo === 'erro' && (
              <p className="flex flex-wrap items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm text-white shadow-lg">
                <span>{aviso.texto}</span>
                {aviso.href && (
                  <Link href={aviso.href} className="font-semibold underline">
                    {aviso.rotuloLink ?? 'Entrar'}
                  </Link>
                )}
                <button type="button" onClick={r.dispensarAviso} className={`${BOTAO_LEVE} ml-auto text-white! hover:bg-red-800!`} aria-label="Fechar aviso">
                  Fechar
                </button>
              </p>
            )}
          </div>
        </div>
        {status === 'pronto' && <BarraExportacao totalAtivos={totais.ativos} exportando={r.exportando} aoExportar={(f) => void r.exportar(f)} />}
      </div>
    </main>
  );
}
