'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { obterMe, type Me } from '@/lib/sessao';

export function Cabecalho() {
  const caminho = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    obterMe()
      .then((resultado) => {
        if (ativo) setMe(resultado);
      })
      .catch(() => {
        if (ativo) setMe(null);
      });
    return () => {
      ativo = false;
    };
  }, [caminho]);

  const usuario = me?.usuario;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-indigo-700">
          Cardify
        </Link>
        <nav aria-label="Conta" className="flex min-w-0 items-center gap-3 text-sm">
          {me === undefined ? null : usuario ? (
            <>
              <span className="max-w-[10rem] truncate text-slate-600" title={usuario.email}>
                {usuario.email}
              </span>
              <Link href="/conta" className="font-medium text-indigo-700 hover:underline">
                Conta
              </Link>
            </>
          ) : (
            <Link href="/entrar" className="font-medium text-indigo-700 hover:underline">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
