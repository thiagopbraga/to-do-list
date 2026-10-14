import type { LlmProvider, LlmRequisicao, LlmResposta } from '@cardify/shared';

export interface OpcoesFakeLlm {
  /** Fila de respostas literais, consumidas uma por chamada; esgotada, volta ao modo determinístico. */
  respostas?: string[];
  latenciaMs?: number;
}

interface FatoFake {
  afirmacao: string;
  categoria: string;
  fonteOffset: number;
}

function entre(texto: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(texto);
  return m?.[1];
}

function categoriaDe(frase: string): string {
  if (/\d/.test(frase)) return 'numero';
  if (/ (é|são) /.test(frase)) return 'definicao';
  if ((frase.match(/,/g) ?? []).length >= 2) return 'enumeracao';
  return 'relacao';
}

function extrairFatos(documento: string): FatoFake[] {
  const fatos: FatoFake[] = [];
  const regex = /[^.!?]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(documento)) !== null) {
    const frase = m[0].trim();
    if (frase.length < 30) continue;
    fatos.push({ afirmacao: frase, categoria: categoriaDe(frase), fonteOffset: m.index + m[0].indexOf(frase) });
  }
  return fatos;
}

function truncar(texto: string, max: number): string {
  return texto.length <= max ? texto : texto.slice(0, max);
}

function montarCards(fatos: FatoFake[], preferencia: string, secao: string) {
  return fatos.map((fato, i) => {
    const cloze = preferencia === 'cloze' || (preferencia === 'misto' && i % 2 === 1);
    const base = { tagSecao: secao, fonteOffset: fato.fonteOffset };
    if (!cloze) {
      const inicio = fato.afirmacao.split(/\s+/).slice(0, 6).join(' ');
      return {
        tipo: 'basico',
        frente: truncar(`Sobre "${inicio}...": o que o material afirma?`, 300),
        verso: truncar(fato.afirmacao, 500),
        textoCloze: null,
        ...base,
      };
    }
    const palavras = fato.afirmacao.match(/\p{L}+/gu) ?? [];
    const longas = palavras.filter((p) => p.length >= 6);
    const alvo = (longas.length > 0 ? longas : palavras).reduce((a, b) => (b.length > a.length ? b : a), '');
    return {
      tipo: 'cloze',
      frente: truncar(fato.afirmacao, 300),
      verso: truncar(alvo, 500),
      textoCloze: alvo ? fato.afirmacao.replace(alvo, `{{c1::${alvo}}}`) : fato.afirmacao,
      ...base,
    };
  });
}

/** Provider determinístico para testes e dev (LLM_PROVIDER=fake). */
export class FakeLlmProvider implements LlmProvider {
  private readonly respostas: string[];
  private readonly latenciaMs: number;

  constructor(opcoes: OpcoesFakeLlm = {}) {
    this.respostas = [...(opcoes.respostas ?? [])];
    this.latenciaMs = opcoes.latenciaMs ?? 0;
  }

  async completar(req: LlmRequisicao): Promise<LlmResposta> {
    const texto = this.respostas.shift() ?? this.gerar(req);
    const chars = req.sistema.length + req.mensagens.reduce((s, m) => s + m.conteudo.length, 0);
    return {
      texto,
      modelo: req.tier === 'forte' ? 'fake-forte' : 'fake-economico',
      tokensIn: Math.ceil(chars / 4),
      tokensOut: Math.ceil(texto.length / 4),
      latenciaMs: this.latenciaMs,
    };
  }

  private gerar(req: LlmRequisicao): string {
    const propriedades = (req.jsonSchema?.['properties'] ?? {}) as Record<string, unknown>;
    const ultimaUser = [...req.mensagens].reverse().find((m) => m.papel === 'user')?.conteudo ?? '';

    if ('fatos' in propriedades) {
      return JSON.stringify({ fatos: extrairFatos(entre(ultimaUser, 'documento') ?? '') });
    }
    if ('cards' in propriedades) {
      let fatos: FatoFake[] = [];
      try {
        fatos = JSON.parse(entre(ultimaUser, 'fatos') ?? '[]') as FatoFake[];
      } catch {
        fatos = [];
      }
      const preferencia = entre(ultimaUser, 'preferencia_tipo')?.trim() || 'misto';
      const secao = entre(ultimaUser, 'secao')?.trim() ?? '';
      return JSON.stringify({ cards: montarCards(fatos, preferencia, secao) });
    }
    return 'ok';
  }
}
