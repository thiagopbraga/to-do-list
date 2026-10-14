'use client';

import { useState } from 'react';
import { formatarBytes } from '@/components/formatar';

interface Props {
  arquivo: File | null;
  limiteBytes: number;
  aoEscolher: (arquivo: File) => void;
}

export function ZonaPdf({ arquivo, limiteBytes, aoEscolher }: Props) {
  const [arrastando, setArrastando] = useState(false);

  return (
    <label
      htmlFor="arquivo-pdf"
      onDragOver={(evento) => {
        evento.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(evento) => {
        evento.preventDefault();
        setArrastando(false);
        const primeiro = evento.dataTransfer.files[0];
        if (primeiro) aoEscolher(primeiro);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
        arrastando ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      <input
        id="arquivo-pdf"
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(evento) => {
          const escolhido = evento.target.files?.[0];
          evento.target.value = '';
          if (escolhido) aoEscolher(escolhido);
        }}
      />
      <span className="break-all font-medium text-slate-800">
        {arquivo ? arquivo.name : 'Arraste o PDF aqui ou toque para escolher'}
      </span>
      <span className="text-sm text-slate-500">
        {arquivo ? formatarBytes(arquivo.size) : `Somente PDF, até ${formatarBytes(limiteBytes)}`}
      </span>
    </label>
  );
}
