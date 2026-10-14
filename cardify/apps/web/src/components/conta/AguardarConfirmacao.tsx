'use client';

import { useEffect, useRef } from 'react';
import { obterAssinatura } from '../../lib/api-conta';

interface Props {
  aoAtivar: () => void;
  aoExpirar: () => void;
  intervaloMs?: number;
  limiteMs?: number;
}

/** Consulta GET /assinatura até o status virar 'ativa' (PRD §14, item 5: confirmação do Pix em segundos). */
export function AguardarConfirmacao({ aoAtivar, aoExpirar, intervaloMs = 3000, limiteMs = 10 * 60 * 1000 }: Props) {
  const aoAtivarRef = useRef(aoAtivar);
  const aoExpirarRef = useRef(aoExpirar);

  useEffect(() => {
    aoAtivarRef.current = aoAtivar;
    aoExpirarRef.current = aoExpirar;
  });

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inicio = Date.now();

    const consultar = async () => {
      let ativa = false;
      try {
        ativa = (await obterAssinatura()).status === 'ativa';
      } catch {
        // falha de rede ou da API: a próxima tentativa segue até o limite
      }
      if (!ativo) return;
      if (ativa) {
        aoAtivarRef.current();
        return;
      }
      if (Date.now() - inicio >= limiteMs) {
        aoExpirarRef.current();
        return;
      }
      timer = setTimeout(consultar, intervaloMs);
    };

    void consultar();
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [intervaloMs, limiteMs]);

  return null;
}
