'use client';

import { useState } from 'react';

interface Props {
  copiaECola: string;
  qrCodeBase64?: string;
}

export function QrPix({ copiaECola, qrCodeBase64 }: Props) {
  const [situacaoCopia, setSituacaoCopia] = useState<'nenhuma' | 'copiado' | 'falhou'>('nenhuma');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(copiaECola);
      setSituacaoCopia('copiado');
    } catch {
      setSituacaoCopia('falhou');
    }
  }

  const srcQr = qrCodeBase64 ? (qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`) : null;

  return (
    <div className="space-y-4">
      {srcQr && (
        <div className="flex justify-center">
          <img src={srcQr} alt="QR Code para pagar com Pix" width={224} height={224} className="size-56 rounded-lg border border-slate-200 bg-white p-2" />
        </div>
      )}

      <div>
        <label htmlFor="pix-copia-e-cola" className="block text-sm font-medium text-slate-800">
          Pix copia e cola
        </label>
        <textarea
          id="pix-copia-e-cola"
          readOnly
          rows={3}
          value={copiaECola}
          onFocus={(evento) => evento.currentTarget.select()}
          className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs break-all text-slate-700"
        />
        <button
          type="button"
          onClick={copiar}
          className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto"
        >
          Copiar código Pix
        </button>
        <p role="status" className="mt-2 min-h-5 text-sm">
          {situacaoCopia === 'copiado' && <span className="text-emerald-700">Código copiado.</span>}
          {situacaoCopia === 'falhou' && <span className="text-slate-700">Não foi possível copiar. Selecione o código acima e copie manualmente.</span>}
        </p>
      </div>

      <p className="text-sm text-slate-600">Pague no app do seu banco; a confirmação chega em segundos.</p>
    </div>
  );
}
