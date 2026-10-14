'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { PLANOS } from '@cardify/shared';
import { obterCota, type Cota } from '../../lib/api';
import {
  cancelarAssinatura,
  excluirConta,
  obterAssinatura,
  obterSessao,
  sairDaConta,
  type AssinaturaConta,
  type UsuarioConta,
} from '../../lib/api-conta';
import { formatarData } from '../../lib/documentos';
import { BarraCota } from './BarraCota';

const FRASE_EXCLUSAO = 'EXCLUIR';

function descreverAssinatura(assinatura: AssinaturaConta): { titulo: string; detalhe: string | null } {
  const fim = formatarData(assinatura.periodoFim);
  const nome = PLANOS[assinatura.plano].nome;
  switch (assinatura.status) {
    case 'ativa':
      return { titulo: `Plano ${nome} ativo`, detalhe: fim ? `Período atual até ${fim}.` : null };
    case 'pendente':
      return {
        titulo: `Plano ${nome}: pagamento pendente`,
        detalhe: 'Conclua o pagamento para ativar o plano.',
      };
    case 'atrasada':
      return {
        titulo: `Plano ${nome}: pagamento em atraso`,
        detalhe: fim ? `Regularize o pagamento. Período vigente até ${fim}.` : 'Regularize o pagamento para manter o plano.',
      };
    case 'cancelada':
      return {
        titulo: `Plano ${nome} cancelado`,
        detalhe: fim ? `Período vigente até ${fim}.` : 'Esta assinatura foi encerrada.',
      };
    default:
      return {
        titulo: 'Plano Grátis',
        detalhe: `Você pode gerar até ${PLANOS.gratis.cotaCardsMes} cards por mês.`,
      };
  }
}

export function PainelConta() {
  const router = useRouter();
  const idBase = useId();
  const [carregando, setCarregando] = useState(true);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioConta | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaConta | null>(null);
  const [falhaAssinatura, setFalhaAssinatura] = useState(false);
  const [cota, setCota] = useState<Cota | null>(null);
  const [falhaCota, setFalhaCota] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [textoExclusao, setTextoExclusao] = useState('');

  const atualizarDados = useCallback(async () => {
    const [assinaturaResultado, cotaResultado] = await Promise.allSettled([obterAssinatura(), obterCota()]);
    if (assinaturaResultado.status === 'fulfilled') {
      setAssinatura(assinaturaResultado.value);
      setFalhaAssinatura(false);
    } else {
      setFalhaAssinatura(true);
    }
    if (cotaResultado.status === 'fulfilled') {
      setCota(cotaResultado.value);
      setFalhaCota(false);
    } else {
      setFalhaCota(true);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    obterSessao()
      .then(async (sessao) => {
        if (!ativo) return;
        if (!sessao.usuario) {
          router.replace('/entrar?retorno=%2Fconta');
          return;
        }
        setUsuario(sessao.usuario);
        await atualizarDados();
      })
      .catch(() => {
        if (ativo) setFalhaCarga(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [router, atualizarDados]);

  async function cancelar() {
    setOcupado(true);
    setErroAcao(null);
    try {
      await cancelarAssinatura();
      await atualizarDados();
      setConfirmandoCancelamento(false);
      setAviso('Assinatura cancelada.');
    } catch {
      setErroAcao('Não foi possível cancelar agora. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  async function sair() {
    setOcupado(true);
    setErroAcao(null);
    try {
      await sairDaConta();
      router.replace('/');
      router.refresh();
    } catch {
      setOcupado(false);
      setErroAcao('Não foi possível sair agora. Tente de novo.');
    }
  }

  async function excluir() {
    setOcupado(true);
    setErroAcao(null);
    try {
      await excluirConta();
      router.replace('/');
      router.refresh();
    } catch {
      setOcupado(false);
      setErroAcao('Não foi possível excluir a conta agora. Tente de novo.');
    }
  }

  if (carregando) {
    return <p role="status" className="text-sm text-slate-600">Carregando sua conta…</p>;
  }

  if (falhaCarga) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
        Não foi possível carregar sua conta agora. Tente de novo em instantes.
      </p>
    );
  }

  if (!usuario) {
    return <p role="status" className="text-sm text-slate-600">Redirecionando para o login…</p>;
  }

  const descricao = assinatura ? descreverAssinatura(assinatura) : null;
  const podeCancelar = assinatura !== null && assinatura.status !== null && assinatura.status !== 'cancelada';
  const exclusaoLiberada = textoExclusao === FRASE_EXCLUSAO;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Minha conta</h1>
      </header>

      {(aviso || erroAcao) && (
        <p role={erroAcao ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${erroAcao ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {erroAcao ?? aviso}
        </p>
      )}

      <section aria-labelledby={`${idBase}-dados`} className="space-y-2">
        <h2 id={`${idBase}-dados`} className="text-lg font-semibold text-slate-900">
          Dados
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-600">E-mail</dt>
          <dd className="break-all text-slate-900">{usuario.email}</dd>
          {usuario.nome && (
            <>
              <dt className="text-slate-600">Nome</dt>
              <dd className="text-slate-900">{usuario.nome}</dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby={`${idBase}-assinatura`} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 id={`${idBase}-assinatura`} className="text-lg font-semibold text-slate-900">
          Assinatura
        </h2>

        {falhaAssinatura && <p className="text-sm text-red-700">Não foi possível carregar sua assinatura.</p>}

        {descricao && (
          <div className="space-y-1">
            <p className="font-medium text-slate-900">{descricao.titulo}</p>
            {descricao.detalhe && <p className="text-sm text-slate-600">{descricao.detalhe}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/planos"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Mudar de plano
          </Link>
          {podeCancelar && !confirmandoCancelamento && (
            <button
              type="button"
              onClick={() => {
                setAviso(null);
                setConfirmandoCancelamento(true);
              }}
              disabled={ocupado}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar assinatura
            </button>
          )}
        </div>

        {podeCancelar && confirmandoCancelamento && (
          <div role="alertdialog" aria-labelledby={`${idBase}-confirma-cancelar`} className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p id={`${idBase}-confirma-cancelar`} className="text-sm font-medium text-amber-950">
              Tem certeza que deseja cancelar sua assinatura?
            </p>
            <p className="text-sm text-amber-900">
              Você mantém o plano atual até o fim do período já pago e não será cobrado de novo.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={cancelar}
                disabled={ocupado}
                className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                {ocupado ? 'Cancelando…' : 'Sim, cancelar assinatura'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoCancelamento(false)}
                disabled={ocupado}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                Manter assinatura
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby={`${idBase}-uso`} className="space-y-3">
        <h2 id={`${idBase}-uso`} className="text-lg font-semibold text-slate-900">
          Uso do mês
        </h2>
        {falhaCota && <p className="text-sm text-red-700">Não foi possível carregar seu uso agora.</p>}
        {cota && (
          <BarraCota
            confirmados={cota.confirmados}
            reservados={cota.reservados}
            limite={cota.limite}
            restante={cota.restante}
            periodoFim={cota.periodoFim}
          />
        )}
      </section>

      <section aria-labelledby={`${idBase}-sessao`} className="space-y-3">
        <h2 id={`${idBase}-sessao`} className="text-lg font-semibold text-slate-900">
          Sessão
        </h2>
        <button
          type="button"
          onClick={sair}
          disabled={ocupado}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
        >
          Sair
        </button>
      </section>

      <section aria-labelledby={`${idBase}-exclusao`} className="space-y-3 rounded-2xl border border-red-200 p-5">
        <h2 id={`${idBase}-exclusao`} className="text-lg font-semibold text-red-800">
          Excluir conta
        </h2>
        <p className="text-sm text-slate-700">
          A exclusão é imediata: cancela sua assinatura, se houver, e apaga sua conta e todos os seus dados. Não é possível desfazer.
        </p>
        <div>
          <label htmlFor={`${idBase}-frase`} className="block text-sm font-medium text-slate-800">
            Digite <span className="font-mono font-semibold">{FRASE_EXCLUSAO}</span> para confirmar
          </label>
          <input
            id={`${idBase}-frase`}
            type="text"
            autoComplete="off"
            value={textoExclusao}
            onChange={(evento) => setTextoExclusao(evento.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-base text-slate-900"
          />
        </div>
        <button
          type="button"
          onClick={excluir}
          disabled={!exclusaoLiberada || ocupado}
          className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300 sm:w-auto"
        >
          Excluir minha conta e todos os dados
        </button>
      </section>
    </div>
  );
}
