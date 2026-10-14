'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { ErroApi } from '../../lib/api';
import { obterSessao, pedirLinkDeAcesso } from '../../lib/api-conta';

const MENSAGENS_ERRO: Record<string, string> = {
  link_invalido: 'Este link de acesso é inválido ou já expirou. Peça um novo abaixo.',
  google_falhou: 'Não foi possível entrar com o Google. Tente de novo ou use o e-mail.',
  google_indisponivel: 'Entrar com o Google não está disponível agora. Use o e-mail.',
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  retorno: string;
  erro: string | null;
}

export function EntrarCliente({ retorno, erro }: Props) {
  const router = useRouter();
  const idBase = useId();
  const [verificando, setVerificando] = useState(true);
  const [email, setEmail] = useState('');
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    obterSessao()
      .then((sessao) => {
        if (!ativo) return;
        if (sessao.usuario) {
          router.replace(retorno);
        } else {
          setVerificando(false);
        }
      })
      .catch(() => {
        if (ativo) setVerificando(false);
      });
    return () => {
      ativo = false;
    };
  }, [retorno, router]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const endereco = email.trim();
    if (!EMAIL_VALIDO.test(endereco)) {
      setErroEnvio('Informe um e-mail válido.');
      return;
    }
    setErroEnvio(null);
    setEnviando(true);
    try {
      await pedirLinkDeAcesso(endereco, retorno);
      setEnviadoPara(endereco);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 400) {
        setErroEnvio('Informe um e-mail válido.');
      } else if (erro instanceof ErroApi && erro.status === 429) {
        setErroEnvio('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      } else {
        setErroEnvio('Não foi possível enviar o link agora. Tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const mensagemErro = erro ? MENSAGENS_ERRO[erro] : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Entrar no Cardify</h1>
        <p className="text-slate-600">Seus cards de amostra continuam com você depois de entrar.</p>
      </header>

      {mensagemErro && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {mensagemErro}
        </p>
      )}

      {verificando ? (
        <p role="status" className="text-sm text-slate-600">
          Carregando…
        </p>
      ) : (
        <>
          <a
            href={`/v1/auth/google?retorno=${encodeURIComponent(retorno)}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Continuar com Google
          </a>

          <div className="flex items-center gap-3 text-xs text-slate-500" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            ou
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          {enviadoPara ? (
            <section aria-labelledby={`${idBase}-confirmacao`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 id={`${idBase}-confirmacao`} className="text-lg font-semibold text-slate-900">
                Confira seu e-mail
              </h2>
              <p className="text-sm text-slate-700">
                Enviamos um link de acesso para <span className="font-medium break-all">{enviadoPara}</span>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEnviadoPara(null);
                  setEmail('');
                }}
                className="text-sm font-medium text-indigo-700 underline hover:text-indigo-900"
              >
                Usar outro e-mail
              </button>
            </section>
          ) : (
            <form onSubmit={enviar} noValidate className="space-y-3">
              <div>
                <label htmlFor={`${idBase}-email`} className="block text-sm font-medium text-slate-800">
                  E-mail
                </label>
                <input
                  id={`${idBase}-email`}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  aria-invalid={erroEnvio ? true : undefined}
                  aria-describedby={`${idBase}-ajuda`}
                  className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 ${erroEnvio ? 'border-red-600' : 'border-slate-300'}`}
                />
                <p id={`${idBase}-ajuda`} className="mt-1 text-xs text-slate-600">
                  Enviaremos um link de acesso para o seu e-mail.
                </p>
              </div>

              {erroEnvio && (
                <p role="alert" className="text-sm text-red-700">
                  {erroEnvio}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-wait disabled:bg-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {enviando ? 'Enviando…' : 'Enviar link de acesso'}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
