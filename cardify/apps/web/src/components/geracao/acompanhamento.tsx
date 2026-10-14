'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type CardRevisao, type CriarJob, JOB_STATUS_FINAIS, type JobResumo, type JobStatus, LIMITES_ANONIMO, type ProgressoEvento } from '@cardify/shared';
import { acompanharJob, criarJob, listarCards, obterJob } from '@/lib/api';
import { type Me, obterMe } from '@/lib/sessao';
import { CartaoGerado } from './cartao-gerado';
import { type ContextoJob, guardarContextoJob, lerContextoJob } from './contexto-job';
import { type AvisoErro, descreverErro } from './erros';
import { Progresso } from './progresso';

type StatusFinal = 'concluido' | 'parcial' | 'falhou';

type Tela =
  | { fase: 'carregando' }
  | { fase: 'indisponivel' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'andamento'; status: JobStatus; percentual: number; cardsGerados: number }
  | { fase: 'pronto'; status: 'concluido' | 'parcial'; cards: CardRevisao[]; total: number }
  | { fase: 'falhou'; mensagem: string };

const BOTAO_PRIMARIO =
  'inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60';
const BOTAO_SECUNDARIO =
  'inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';

function ehFinal(status: JobStatus): status is StatusFinal {
  return JOB_STATUS_FINAIS.includes(status);
}

export function Acompanhamento({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [tela, setTela] = useState<Tela>({ fase: 'carregando' });
  const [me, setMe] = useState<Me | null>(null);
  const [contexto, setContexto] = useState<ContextoJob | null>(null);
  const [gerandoCompleto, setGerandoCompleto] = useState(false);
  const [acaoErro, setAcaoErro] = useState<AvisoErro | null>(null);

  useEffect(() => {
    let ativo = true;
    let parar: (() => void) | undefined;
    setContexto(lerContextoJob(jobId));

    const concluir = async (status: StatusFinal, mensagem: string | null | undefined, meAtual: Me | null) => {
      if (status === 'falhou') {
        if (ativo) setTela({ fase: 'falhou', mensagem: mensagem ?? 'A geração não terminou. Tente de novo.' });
        return;
      }
      try {
        const pagina = await listarCards(jobId, { tamanho: meAtual?.usuario ? 500 : LIMITES_ANONIMO.maxCards });
        if (ativo) setTela({ fase: 'pronto', status, cards: pagina.cards, total: pagina.total });
      } catch {
        if (ativo) setTela({ fase: 'erro', mensagem: 'Não conseguimos carregar os cards. Recarregue a página.' });
      }
    };

    (async () => {
      let meAtual: Me | null = null;
      try {
        meAtual = await obterMe();
      } catch {
        meAtual = null;
      }
      if (!ativo) return;
      setMe(meAtual);

      let job: JobResumo;
      try {
        job = await obterJob(jobId);
      } catch {
        if (ativo) setTela({ fase: 'indisponivel' });
        return;
      }
      if (!ativo) return;

      if (ehFinal(job.status)) {
        await concluir(job.status, job.erro, meAtual);
        return;
      }
      setTela({ fase: 'andamento', status: job.status, percentual: 0, cardsGerados: job.cardsGerados });

      parar = acompanharJob(jobId, (evento: ProgressoEvento) => {
        if (!ativo) return;
        if (ehFinal(evento.status)) {
          void concluir(evento.status, evento.mensagem, meAtual);
          return;
        }
        setTela({ fase: 'andamento', status: evento.status, percentual: evento.percentual, cardsGerados: evento.cardsGerados });
      });
    })();

    return () => {
      ativo = false;
      parar?.();
    };
  }, [jobId]);

  const logado = !!me?.usuario;
  const podeGerarCompleto = logado && !!contexto?.amostra && !!(contexto.documentId || contexto.texto);

  async function gerarBaralhoCompleto() {
    if (!contexto || gerandoCompleto) return;
    setGerandoCompleto(true);
    setAcaoErro(null);
    try {
      const corpo: CriarJob = contexto.documentId
        ? { documentId: contexto.documentId, parametros: contexto.parametros, amostra: false }
        : { texto: contexto.texto, parametros: contexto.parametros, amostra: false };
      const job = await criarJob(corpo);
      guardarContextoJob(job.id, { ...contexto, amostra: false });
      router.push(`/gerar/${job.id}`);
    } catch (erro) {
      setAcaoErro(descreverErro(erro));
      setGerandoCompleto(false);
    }
  }

  if (tela.fase === 'carregando') {
    return <p className="text-slate-600">Carregando a geração…</p>;
  }

  if (tela.fase === 'indisponivel') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Não encontramos esta geração</h1>
        <p className="text-slate-600">Ela pode ter sido apagada ou pertencer a outra conta.</p>
        <Link href="/" className={BOTAO_PRIMARIO}>
          Gerar outro baralho
        </Link>
      </div>
    );
  }

  if (tela.fase === 'erro') {
    return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{tela.mensagem}</p>;
  }

  if (tela.fase === 'andamento') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Gerando seus flashcards</h1>
        <Progresso status={tela.status} percentual={tela.percentual} cardsGerados={tela.cardsGerados} />
        <p className="text-sm text-slate-500">Isso costuma levar menos de 2 minutos.</p>
      </div>
    );
  }

  if (tela.fase === 'falhou') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Não conseguimos gerar os cards</h1>
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {tela.mensagem}
        </p>
        <Link href="/" className={BOTAO_PRIMARIO}>
          Tentar de novo
        </Link>
      </div>
    );
  }

  const quantidade = logado ? tela.total : tela.cards.length;
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">
          {logado
            ? `${quantidade} ${quantidade === 1 ? 'card pronto' : 'cards prontos'}`
            : `Sua amostra com ${quantidade} ${quantidade === 1 ? 'card está pronta' : 'cards está pronta'}`}
        </h1>
        {tela.status === 'parcial' && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Não deu para gerar todos os cards deste material. Os que saíram estão abaixo.
          </p>
        )}
      </header>

      {tela.cards.length === 0 ? (
        <p className="text-slate-600">Nenhum card foi gerado a partir deste material. Tente outro trecho ou ajuste a área.</p>
      ) : (
        <ol aria-label="Cards gerados" className="space-y-3">
          {tela.cards.map((card) => (
            <CartaoGerado key={card.id} card={card} />
          ))}
        </ol>
      )}

      <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        {logado ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={`/revisar/${jobId}`} className={BOTAO_PRIMARIO}>
                Revisar e exportar
              </Link>
              {podeGerarCompleto && (
                <button type="button" onClick={gerarBaralhoCompleto} disabled={gerandoCompleto} className={BOTAO_SECUNDARIO}>
                  {gerandoCompleto ? 'Gerando…' : 'Gerar o baralho completo'}
                </button>
              )}
            </div>
            {acaoErro && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {acaoErro.texto}
                {acaoErro.link && (
                  <>
                    {' '}
                    <Link href={acaoErro.link.href} className="font-medium underline">
                      {acaoErro.link.rotulo}
                    </Link>
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-slate-700">Entre com Google ou e-mail para gerar todos os cards deste material. Esta geração fica vinculada à sua conta.</p>
            <Link href={`/entrar?retorno=${encodeURIComponent(`/gerar/${jobId}`)}`} className={BOTAO_PRIMARIO}>
              Gerar todos os cards
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
