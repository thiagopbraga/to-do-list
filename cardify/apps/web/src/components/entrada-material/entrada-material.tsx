'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { type CriarJob, type JobResumo, LIMITES_ANONIMO, LIMITES_DOCUMENTO, type ParametrosGeracao } from '@cardify/shared';
import { ErroApi, api, concluirUpload, criarUpload, enviarArquivo } from '@/lib/api';
import { type EstadoAnonimo, garantirSessao, obterEstadoAnonimo, obterMe } from '@/lib/sessao';
import { formatarBytes } from '@/components/formatar';
import { guardarContextoJob } from '@/components/geracao/contexto-job';
import { type AvisoErro, descreverErro } from '@/components/geracao/erros';
import { ControlesParametros } from './controles';
import { Turnstile } from './turnstile';
import { ZonaPdf } from './zona-pdf';

const PARAMETROS_PADRAO: ParametrosGeracao = { densidade: 'equilibrado', tipo: 'misto', area: 'geral' };
const LINK_ENTRAR = { href: '/entrar', rotulo: 'Entrar para continuar' };
const MIN_CARACTERES_TEXTO = 50;

type Aba = 'pdf' | 'texto';
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'pdf', rotulo: 'Subir PDF' },
  { valor: 'texto', rotulo: 'Colar texto' },
];

function avisoSemGeracaoGratis(estado: EstadoAnonimo): AvisoErro {
  return estado.geracoesHoje >= estado.limiteDiario
    ? { texto: `Você já usou suas ${estado.limiteDiario} gerações grátis de hoje.`, link: LINK_ENTRAR }
    : { texto: 'A geração grátis não está disponível agora.', link: LINK_ENTRAR };
}

async function enviarPdf(arquivo: File): Promise<string> {
  const { documentId, upload } = await criarUpload(arquivo);
  await enviarArquivo(upload, arquivo);
  await concluirUpload(documentId);
  return documentId;
}

export function EntradaMaterial() {
  const router = useRouter();
  const [logado, setLogado] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<EstadoAnonimo | null>(null);
  const [aba, setAba] = useState<Aba>('pdf');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState('');
  const [parametros, setParametros] = useState<ParametrosGeracao>(PARAMETROS_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<AvisoErro | null>(null);
  const [turnstile, setTurnstile] = useState<{ siteKey: string; contador: number } | null>(null);
  const [tokenTurnstile, setTokenTurnstile] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    obterMe()
      .then(async (me) => {
        if (!ativo) return;
        if (me.usuario) {
          setLogado(true);
          return;
        }
        setLogado(false);
        const estadoInicial = await obterEstadoAnonimo();
        if (ativo) setEstado(estadoInicial);
      })
      .catch(() => {
        if (ativo) setLogado(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const anonimo = logado !== true;
  const limiteBytes = anonimo ? LIMITES_ANONIMO.maxBytes : LIMITES_DOCUMENTO.maxBytes;
  const semGeracaoGratis = anonimo && estado !== null && !estado.disponivel;
  const geracoesRestantes = estado ? Math.max(0, estado.limiteDiario - estado.geracoesHoje) : null;

  function escolherArquivo(escolhido: File) {
    const ehPdf = escolhido.type === 'application/pdf' || /\.pdf$/i.test(escolhido.name);
    if (!ehPdf) {
      setArquivo(null);
      setAviso({ texto: 'O arquivo precisa ser um PDF.' });
      return;
    }
    if (escolhido.size > limiteBytes) {
      setArquivo(null);
      setAviso(
        anonimo
          ? {
              texto: `Na amostra grátis, o PDF pode ter até ${formatarBytes(LIMITES_ANONIMO.maxBytes)}. Entre para enviar arquivos de até ${formatarBytes(LIMITES_DOCUMENTO.maxBytes)}.`,
              link: LINK_ENTRAR,
            }
          : { texto: `O PDF pode ter até ${formatarBytes(LIMITES_DOCUMENTO.maxBytes)}.` },
      );
      return;
    }
    setAviso(null);
    setArquivo(escolhido);
  }

  function validar(): string | null {
    if (aba === 'pdf') return arquivo ? null : 'Escolha um arquivo PDF.';
    const tamanho = texto.trim().length;
    if (tamanho < MIN_CARACTERES_TEXTO) return `O texto precisa ter pelo menos ${MIN_CARACTERES_TEXTO} caracteres.`;
    if (tamanho > LIMITES_DOCUMENTO.maxCaracteresTexto) {
      return `O texto pode ter no máximo ${LIMITES_DOCUMENTO.maxCaracteresTexto.toLocaleString('pt-BR')} caracteres.`;
    }
    return null;
  }

  /** Exibe o widget com um desafio novo: o token é de uso único. */
  function exibirTurnstile(siteKey: string) {
    setTokenTurnstile(null);
    setTurnstile((atual) => ({ siteKey, contador: (atual?.contador ?? 0) + 1 }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const problema = validar();
    if (problema) {
      setAviso({ texto: problema });
      return;
    }
    setAviso(null);
    setEnviando(true);
    try {
      const me = await garantirSessao();
      const ehAmostra = !me.usuario;
      const headers: Record<string, string> = {};

      if (ehAmostra) {
        const estadoAtual = await obterEstadoAnonimo();
        setEstado(estadoAtual);
        if (!estadoAtual.disponivel) {
          setAviso(avisoSemGeracaoGratis(estadoAtual));
          return;
        }
        if (estadoAtual.exigeTurnstile) {
          if (tokenTurnstile) {
            headers['X-Turnstile-Token'] = tokenTurnstile;
          } else if (estadoAtual.siteKey) {
            exibirTurnstile(estadoAtual.siteKey);
            setAviso({ texto: 'Confirme que você não é um robô para continuar.' });
            return;
          }
        }
      }

      const documentId = aba === 'pdf' && arquivo ? await enviarPdf(arquivo) : undefined;
      const textoEnviado = aba === 'texto' ? texto.trim() : undefined;
      const corpo: CriarJob = documentId
        ? { documentId, parametros, amostra: ehAmostra }
        : { texto: textoEnviado, parametros, amostra: ehAmostra };

      const job = await api<JobResumo>('/jobs', { corpo, headers });
      guardarContextoJob(job.id, { amostra: ehAmostra, parametros, documentId, texto: textoEnviado });
      router.push(`/gerar/${job.id}`);
    } catch (erro) {
      setTokenTurnstile(null);
      if (erro instanceof ErroApi && erro.erro === 'turnstile_necessario') {
        const estadoAtual = await obterEstadoAnonimo().catch(() => null);
        if (estadoAtual) setEstado(estadoAtual);
        if (estadoAtual?.siteKey) exibirTurnstile(estadoAtual.siteKey);
        setAviso({ texto: 'Confirme que você não é um robô abaixo e tente de novo.' });
      } else {
        setAviso(descreverErro(erro));
      }
    } finally {
      setEnviando(false);
    }
  }

  const textoBotao = enviando ? 'Enviando…' : anonimo ? 'Gerar amostra grátis' : 'Gerar flashcards';
  const avisoBloqueio = semGeracaoGratis && estado ? avisoSemGeracaoGratis(estado) : null;

  return (
    <section aria-labelledby="entrada-titulo" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="entrada-titulo" className="text-lg font-semibold">
        Comece com o seu material
      </h2>

      <form onSubmit={enviar} noValidate className="mt-4 space-y-5">
        <div role="tablist" aria-label="Origem do material" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {ABAS.map((item) => (
            <button
              key={item.valor}
              type="button"
              role="tab"
              id={`aba-${item.valor}`}
              aria-selected={aba === item.valor}
              aria-controls="painel-material"
              onClick={() => setAba(item.valor)}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 aria-selected:bg-white aria-selected:text-slate-900 aria-selected:shadow-sm"
            >
              {item.rotulo}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="painel-material" aria-labelledby={`aba-${aba}`}>
          {aba === 'pdf' ? (
            <ZonaPdf arquivo={arquivo} limiteBytes={limiteBytes} aoEscolher={escolherArquivo} />
          ) : (
            <div>
              <label htmlFor="texto-material" className="mb-2 block text-sm font-medium text-slate-700">
                Texto do material
              </label>
              <textarea
                id="texto-material"
                rows={8}
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                aria-describedby="contador-texto"
                placeholder="Cole aqui um trecho de aula, resumo ou capítulo."
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base focus:border-indigo-600 focus:outline-none"
              />
              <p id="contador-texto" className="mt-1 text-sm text-slate-500">
                {texto.trim().length.toLocaleString('pt-BR')} / {LIMITES_DOCUMENTO.maxCaracteresTexto.toLocaleString('pt-BR')} caracteres
                {texto.trim().length < MIN_CARACTERES_TEXTO && ` · mínimo de ${MIN_CARACTERES_TEXTO}`}
              </p>
            </div>
          )}
        </div>

        <ControlesParametros valor={parametros} aoMudar={setParametros} />

        {turnstile && (
          <div>
            <p className="mb-2 text-sm text-slate-600">Confirme que você não é um robô:</p>
            <Turnstile key={turnstile.contador} siteKey={turnstile.siteKey} aoObterToken={setTokenTurnstile} />
          </div>
        )}

        {avisoBloqueio && <MensagemAviso aviso={avisoBloqueio} tom="atencao" />}
        {aviso && <MensagemAviso aviso={aviso} tom="erro" />}

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={enviando || semGeracaoGratis}
            className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {textoBotao}
          </button>
          <p className="text-sm text-slate-500">
            {anonimo
              ? `Amostra de até ${LIMITES_ANONIMO.maxCards} cards, sem cadastro.${
                  geracoesRestantes !== null && !semGeracaoGratis
                    ? ` Restam ${geracoesRestantes} ${geracoesRestantes === 1 ? 'geração grátis' : 'gerações grátis'} hoje.`
                    : ''
                }`
              : 'Os cards ficam na sua conta para revisar e exportar.'}
          </p>
        </div>
      </form>
    </section>
  );
}

function MensagemAviso({ aviso, tom }: { aviso: AvisoErro; tom: 'erro' | 'atencao' }) {
  const estilo = tom === 'erro' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900';
  return (
    <p role={tom === 'erro' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${estilo}`}>
      {aviso.texto}
      {aviso.link && (
        <>
          {' '}
          <Link href={aviso.link.href} className="font-medium underline">
            {aviso.link.rotulo}
          </Link>
        </>
      )}
    </p>
  );
}
