'use client';

import Link from 'next/link';
import { useId, useRef, useState, type FormEvent } from 'react';
import type { MetodoPagamento, PlanoPago, ResultadoAssinatura } from '@cardify/shared';
import { ErroApi } from '../../lib/api';
import { assinarPlano } from '../../lib/api-conta';
import { classificarDocumento, mascararCpfOuCnpj, somenteDigitos } from '../../lib/documentos';

const METODOS: { valor: MetodoPagamento; rotulo: string; detalhe?: string }[] = [
  { valor: 'pix', rotulo: 'Pix', detalhe: 'confirmação em segundos' },
  { valor: 'cartao', rotulo: 'Cartão de crédito' },
  { valor: 'boleto', rotulo: 'Boleto bancário' },
];

interface Props {
  plano: PlanoPago;
  nomePlano: string;
  aoResultado: (resultado: ResultadoAssinatura, metodo: MetodoPagamento) => void;
}

export function FormularioPagamento({ plano, nomePlano, aoResultado }: Props) {
  const idBase = useId();
  const campoDocumento = useRef<HTMLInputElement>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento>('pix');
  const [documento, setDocumento] = useState('');
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<{ mensagem: string; conflito: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroEnvio(null);
    const digitos = somenteDigitos(documento);
    if (!classificarDocumento(digitos)) {
      setErroDocumento('Informe um CPF ou CNPJ válido.');
      campoDocumento.current?.focus();
      return;
    }
    setErroDocumento(null);
    setEnviando(true);
    try {
      const resultado = await assinarPlano({ plano, metodo, cpfCnpj: digitos });
      aoResultado(resultado, metodo);
    } catch (erro) {
      setEnviando(false);
      if (erro instanceof ErroApi && erro.status === 409) {
        setErroEnvio({ mensagem: 'Você já tem uma assinatura ativa.', conflito: true });
      } else {
        setErroEnvio({ mensagem: 'Não foi possível gerar o pagamento agora. Tente de novo.', conflito: false });
      }
    }
  }

  return (
    <form onSubmit={enviar} noValidate aria-labelledby={`${idBase}-titulo`} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id={`${idBase}-titulo`} className="text-lg font-semibold text-slate-900">
        Assinar o plano {nomePlano}
      </h2>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-slate-800">Forma de pagamento</legend>
        {METODOS.map((opcao) => (
          <label
            key={opcao.valor}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${metodo === opcao.valor ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300'}`}
          >
            <input
              type="radio"
              name={`${idBase}-metodo`}
              value={opcao.valor}
              checked={metodo === opcao.valor}
              onChange={() => setMetodo(opcao.valor)}
              className="size-4 accent-indigo-600"
            />
            <span>
              <span className="font-medium text-slate-900">{opcao.rotulo}</span>
              {opcao.valor === 'pix' && <span className="ml-1 text-xs font-medium text-indigo-800">(padrão)</span>}
              {opcao.detalhe && <span className="block text-xs text-slate-600">{opcao.detalhe}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor={`${idBase}-documento`} className="block text-sm font-medium text-slate-800">
          CPF ou CNPJ
        </label>
        <input
          id={`${idBase}-documento`}
          ref={campoDocumento}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          placeholder="000.000.000-00"
          value={documento}
          onChange={(evento) => {
            setDocumento(mascararCpfOuCnpj(evento.target.value));
            if (erroDocumento) setErroDocumento(null);
          }}
          aria-invalid={erroDocumento ? true : undefined}
          aria-describedby={erroDocumento ? `${idBase}-erro-documento` : `${idBase}-ajuda-documento`}
          className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 ${erroDocumento ? 'border-red-600' : 'border-slate-300'}`}
        />
        {erroDocumento ? (
          <p id={`${idBase}-erro-documento`} role="alert" className="mt-1 text-sm text-red-700">
            {erroDocumento}
          </p>
        ) : (
          <p id={`${idBase}-ajuda-documento`} className="mt-1 text-xs text-slate-600">
            Necessário para emitir a cobrança.
          </p>
        )}
      </div>

      {erroEnvio && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p>{erroEnvio.mensagem}</p>
          {erroEnvio.conflito && (
            <p className="mt-1">
              <Link href="/conta" className="font-medium underline">
                Ver minha assinatura
              </Link>
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-wait disabled:bg-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        {enviando ? 'Gerando pagamento…' : 'Continuar para o pagamento'}
      </button>
    </form>
  );
}
