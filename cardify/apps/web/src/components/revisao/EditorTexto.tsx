'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { PreviaCloze } from './PreviaCloze';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from './estilos';
import type { ResultadoSalvar } from './useRevisao';
import { ocultarSelecao } from './utilitarios';

interface Props {
  rotulo: string;
  valorInicial: string;
  maxLength?: number;
  cloze?: boolean;
  aoSalvar(valor: string): Promise<ResultadoSalvar>;
  aoEncerrar(): void;
}

/** Edição inline: Enter salva, Shift+Enter quebra linha, Esc cancela. O rascunho vive aqui, não na lista. */
export function EditorTexto({ rotulo, valorInicial, maxLength, cloze = false, aoSalvar, aoEncerrar }: Props) {
  const [valor, setValor] = useState(valorInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const encerrado = useRef(false);
  const cursorPendente = useRef<number | null>(null);
  const idErro = useId();
  const idAjuda = useId();

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    if (cursorPendente.current !== null) {
      el.setSelectionRange(cursorPendente.current, cursorPendente.current);
      cursorPendente.current = null;
    }
  }, [valor]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const encerrar = () => {
    encerrado.current = true;
    aoEncerrar();
  };

  const enviar = async () => {
    if (encerrado.current || salvando) return;
    if (valor === valorInicial) {
      encerrar();
      return;
    }
    if (!cloze && valor.trim() === '') {
      setErro('O campo não pode ficar vazio.');
      return;
    }
    setSalvando(true);
    setErro(null);
    const resultado = await aoSalvar(valor);
    setSalvando(false);
    if (resultado.ok) encerrar();
    else setErro(resultado.mensagem);
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      encerrar();
    } else if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      void enviar();
    }
  };

  const aoPerderFoco = (evento: FocusEvent<HTMLDivElement>) => {
    if (evento.relatedTarget instanceof Node && raiz.current?.contains(evento.relatedTarget)) return;
    void enviar();
  };

  const ocultar = () => {
    const el = area.current;
    if (!el) return;
    const resultado = ocultarSelecao(valor, el.selectionStart, el.selectionEnd);
    if (!resultado) {
      setErro('Selecione no texto o trecho que deseja ocultar.');
      return;
    }
    setErro(null);
    cursorPendente.current = resultado.cursor;
    setValor(resultado.texto);
    el.focus();
  };

  return (
    <div ref={raiz} onBlur={aoPerderFoco} className="space-y-2">
      <textarea
        ref={area}
        value={valor}
        rows={1}
        maxLength={maxLength}
        disabled={salvando}
        aria-label={`Editar ${rotulo}`}
        aria-invalid={erro ? true : undefined}
        aria-describedby={`${idAjuda}${erro ? ` ${idErro}` : ''}`}
        onChange={(e) => {
          setValor(e.target.value);
          if (erro) setErro(null);
        }}
        onKeyDown={aoTeclar}
        className={`block w-full resize-none overflow-hidden ${CAMPO}`}
      />
      <p id={idAjuda} className="text-xs text-slate-500">
        Enter salva, Shift+Enter quebra a linha, Esc cancela.
        {cloze ? ' Use {{c1::resposta}} para ocultar um trecho.' : ''}
      </p>
      {cloze && valor.trim() !== '' && (
        <p className="rounded-md bg-slate-50 px-2 py-1.5 text-sm text-slate-800">
          <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Pré-visualização</span>
          <PreviaCloze texto={valor} />
        </p>
      )}
      {erro && (
        <p id={idErro} role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BOTAO_PRIMARIO} onClick={() => void enviar()} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" className={BOTAO_SECUNDARIO} onClick={encerrar} disabled={salvando}>
          Cancelar
        </button>
        {cloze && (
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            onMouseDown={(e) => e.preventDefault()}
            onClick={ocultar}
            disabled={salvando}
            aria-label="Ocultar o trecho selecionado com uma oclusão cloze"
          >
            Ocultar seleção
          </button>
        )}
      </div>
    </div>
  );
}
