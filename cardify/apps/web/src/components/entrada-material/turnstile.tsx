'use client';

import { useEffect, useRef } from 'react';

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

interface TurnstileApi {
  render(
    elemento: HTMLElement,
    opcoes: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let carregamento: Promise<TurnstileApi> | null = null;

function carregarTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  carregamento ??= new Promise<TurnstileApi>((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.src = URL_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolver(window.turnstile);
      else rejeitar(new Error('turnstile indisponível'));
    };
    script.onerror = () => {
      carregamento = null;
      script.remove();
      rejeitar(new Error('falha ao carregar o turnstile'));
    };
    document.head.appendChild(script);
  });
  return carregamento;
}

interface Props {
  siteKey: string;
  /** Recebe o token ao resolver o desafio, ou `null` quando ele expira ou falha. */
  aoObterToken: (token: string | null) => void;
}

/** Widget Turnstile (modo explícito). O token é de uso único: reexibir o widget exige remontá-lo (`key`). */
export function Turnstile({ siteKey, aoObterToken }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const aoObterTokenRef = useRef(aoObterToken);

  useEffect(() => {
    aoObterTokenRef.current = aoObterToken;
  }, [aoObterToken]);

  useEffect(() => {
    let cancelado = false;
    let widgetId: string | undefined;

    carregarTurnstile()
      .then((api) => {
        if (cancelado || !ref.current) return;
        widgetId = api.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => aoObterTokenRef.current(token),
          'expired-callback': () => aoObterTokenRef.current(null),
          'error-callback': () => aoObterTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelado) aoObterTokenRef.current(null);
      });

    return () => {
      cancelado = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={ref} className="min-h-[65px]" />;
}
