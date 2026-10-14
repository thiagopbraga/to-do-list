'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MetodoPagamento, ResultadoAssinatura } from '@cardify/shared';
import { AguardarConfirmacao } from './AguardarConfirmacao';
import { QrPix } from './QrPix';

interface Props {
  resultado: ResultadoAssinatura;
  metodo: MetodoPagamento;
  destino: string;
}

export function PagamentoAssinatura({ resultado, metodo, destino }: Props) {
  const router = useRouter();
  const [situacao, setSituacao] = useState<'aguardando' | 'confirmado' | 'expirado'>('aguardando');

  const ehPix = metodo === 'pix';
  const semPix = ehPix && !resultado.pixCopiaECola;
  const semLink = !ehPix && !resultado.urlPagamento;

  return (
    <section aria-labelledby="titulo-pagamento" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <AguardarConfirmacao
        aoAtivar={() => {
          setSituacao('confirmado');
          router.replace(destino);
        }}
        aoExpirar={() => setSituacao('expirado')}
      />

      <h2 id="titulo-pagamento" className="text-lg font-semibold text-slate-900">
        {ehPix ? 'Pague com Pix' : 'Finalize o pagamento'}
      </h2>

      {situacao === 'confirmado' && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          Pagamento confirmado. Redirecionando…
        </p>
      )}

      {situacao !== 'confirmado' && ehPix && resultado.pixCopiaECola && (
        <QrPix copiaECola={resultado.pixCopiaECola} qrCodeBase64={resultado.pixQrCodeBase64} />
      )}

      {situacao !== 'confirmado' && !ehPix && resultado.urlPagamento && (
        <div className="space-y-3">
          <a
            href={resultado.urlPagamento}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto"
          >
            Abrir página de pagamento
          </a>
          <p className="text-sm text-slate-600">
            A página abre em outra aba. Esta tela confirma automaticamente quando o pagamento for aprovado.
          </p>
        </div>
      )}

      {(semPix || semLink) && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Não foi possível exibir o pagamento agora. Tente gerar novamente.
        </p>
      )}

      {situacao === 'aguardando' && <p role="status" className="text-sm text-slate-600">Aguardando a confirmação do pagamento…</p>}

      {situacao === 'expirado' && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Ainda não recebemos a confirmação. Se você já pagou, o plano será ativado assim que o pagamento for confirmado. Acompanhe em{' '}
          <Link href="/conta" className="font-medium underline">
            Minha conta
          </Link>
          .
        </p>
      )}
    </section>
  );
}
