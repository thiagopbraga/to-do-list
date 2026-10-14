'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PLANOS, type MetodoPagamento, type Plano, type PlanoPago, type ResultadoAssinatura } from '@cardify/shared';
import { obterAssinatura, obterSessao, type AssinaturaConta } from '../../lib/api-conta';
import { formatarPreco } from '../../lib/documentos';
import { CartaoPlano } from './CartaoPlano';
import { FormularioPagamento } from './FormularioPagamento';
import { PagamentoAssinatura } from './PagamentoAssinatura';

const ORDEM: Plano[] = ['gratis', 'essencial', 'anual', 'ilimitado'];
const ECONOMIA_ANUAL = `Economize ${formatarPreco(PLANOS.essencial.precoCentavos * 12 - PLANOS.anual.precoCentavos)} por ano em relação ao Essencial mensal.`;

interface Props {
  /** Para onde voltar após o pagamento confirmado. */
  retorno: string;
  /** Caminho desta página com seus parâmetros, usado para voltar daqui ao login. */
  caminhoAtual: string;
}

type Carregamento = 'verificando' | 'pronto' | 'erro';

export function PlanosCliente({ retorno, caminhoAtual }: Props) {
  const router = useRouter();
  const areaPagamento = useRef<HTMLDivElement>(null);
  const [carregamento, setCarregamento] = useState<Carregamento>('verificando');
  const [assinatura, setAssinatura] = useState<AssinaturaConta | null>(null);
  const [escolhido, setEscolhido] = useState<PlanoPago | null>(null);
  const [pagamento, setPagamento] = useState<{ resultado: ResultadoAssinatura; metodo: MetodoPagamento } | null>(null);

  useEffect(() => {
    let ativo = true;
    obterSessao()
      .then(async (sessao) => {
        if (!ativo) return;
        if (!sessao.usuario) {
          router.replace(`/entrar?retorno=${encodeURIComponent(caminhoAtual)}`);
          return;
        }
        const dados = await obterAssinatura().catch(() => null);
        if (!ativo) return;
        setAssinatura(dados);
        setCarregamento('pronto');
      })
      .catch(() => {
        if (ativo) setCarregamento('erro');
      });
    return () => {
      ativo = false;
    };
  }, [router, caminhoAtual]);

  useEffect(() => {
    if (escolhido || pagamento) areaPagamento.current?.focus();
  }, [escolhido, pagamento]);

  if (carregamento === 'verificando') {
    return <p role="status" className="text-sm text-slate-600">Carregando planos…</p>;
  }

  if (carregamento === 'erro') {
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
        Não foi possível carregar os planos agora. Tente de novo em instantes.
      </p>
    );
  }

  const assinaturaAtiva = assinatura?.status === 'ativa';
  const planoAtual = assinatura && (assinatura.status === null || assinatura.status === 'ativa') ? assinatura.plano : null;
  const nomePlanoEscolhido = escolhido ? PLANOS[escolhido].nome : '';

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Escolha seu plano</h1>
        <p className="text-slate-600">Seus cards de amostra já estão prontos. Assine para gerar os restantes e exportar o baralho para o Anki.</p>
      </header>

      {assinaturaAtiva && assinatura && (
        <p role="status" className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-900">
          Você já tem a assinatura {PLANOS[assinatura.plano].nome} ativa. Para trocar de plano, cancele a atual em{' '}
          <Link href="/conta" className="font-medium underline">
            Minha conta
          </Link>
          .
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ORDEM.map((plano) => (
          <CartaoPlano
            key={plano}
            plano={plano}
            recomendado={plano === 'essencial'}
            atual={planoAtual === plano}
            bloqueado={assinaturaAtiva}
            economia={plano === 'anual' ? ECONOMIA_ANUAL : undefined}
            aoEscolher={plano === 'gratis' ? undefined : () => {
              setPagamento(null);
              setEscolhido(plano);
            }}
          />
        ))}
      </div>

      <div ref={areaPagamento} tabIndex={-1} className="scroll-mt-6 focus:outline-none">
        {escolhido && !pagamento && (
          <FormularioPagamento
            plano={escolhido}
            nomePlano={nomePlanoEscolhido}
            aoResultado={(resultado, metodo) => setPagamento({ resultado, metodo })}
          />
        )}
        {pagamento && <PagamentoAssinatura resultado={pagamento.resultado} metodo={pagamento.metodo} destino={retorno} />}
      </div>

      {!pagamento && (
        <p className="text-sm">
          <Link href={retorno} className="text-slate-600 underline hover:text-slate-900">
            Continuar sem assinar
          </Link>
        </p>
      )}
    </div>
  );
}
