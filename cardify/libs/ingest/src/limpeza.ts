import { semAcento, type DocumentoExtraido, type LinhaPdf } from '@cardify/shared';

export interface ResultadoLimpeza {
  documento: DocumentoExtraido;
  /** Textos (normalizados) identificados como ruído estrutural. */
  removidas: string[];
}

type Faixa = 'topo' | 'rodape';

const LIMITE_FAIXA_TOPO = 0.08;
const LIMITE_FAIXA_RODAPE = 0.92;

function faixaDe(linha: LinhaPdf): Faixa | null {
  if (linha.yNorm <= LIMITE_FAIXA_TOPO) return 'topo';
  if (linha.yNorm >= LIMITE_FAIXA_RODAPE) return 'rodape';
  return null;
}

function normalizar(texto: string): string {
  return semAcento(texto.replace(/\d/g, ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

interface LinhaClassificada {
  faixa: Faixa;
  chave: string;
}

function classificar(linha: LinhaPdf): LinhaClassificada | null {
  const faixa = faixaDe(linha);
  if (!faixa) return null;
  return { faixa, chave: normalizar(linha.texto) };
}

/** Chaves que aparecem, na mesma faixa, em mais de 60% das páginas distintas. */
function ruidosPorFaixa(doc: DocumentoExtraido): Record<Faixa, Set<string>> {
  const total = doc.paginas.length;
  const paginasPorChave: Record<Faixa, Map<string, Set<number>>> = {
    topo: new Map(),
    rodape: new Map(),
  };

  doc.paginas.forEach((pagina, indice) => {
    for (const linha of pagina.linhas) {
      const classificada = classificar(linha);
      if (!classificada) continue;
      const mapa = paginasPorChave[classificada.faixa];
      const paginas = mapa.get(classificada.chave) ?? new Set<number>();
      paginas.add(indice);
      mapa.set(classificada.chave, paginas);
    }
  });

  const ruidos: Record<Faixa, Set<string>> = { topo: new Set(), rodape: new Set() };
  for (const faixa of ['topo', 'rodape'] as const) {
    for (const [chave, paginas] of paginasPorChave[faixa]) {
      if (paginas.size * 10 > total * 6) ruidos[faixa].add(chave);
    }
  }
  return ruidos;
}

/** T05 — remove cabeçalho, rodapé, numeração e marca d'água repetidos (RFC §3.3). Função pura. */
export function limparRuidoEstrutural(doc: DocumentoExtraido): ResultadoLimpeza {
  const ruidos = doc.paginas.length >= 2 ? ruidosPorFaixa(doc) : { topo: new Set<string>(), rodape: new Set<string>() };
  const removidas: string[] = [];
  const vistas = new Set<string>();

  const paginas = doc.paginas.map((pagina) => {
    const linhas = pagina.linhas
      .filter((linha) => {
        const classificada = classificar(linha);
        if (!classificada || !ruidos[classificada.faixa].has(classificada.chave)) return true;
        if (!vistas.has(classificada.chave)) {
          vistas.add(classificada.chave);
          removidas.push(classificada.chave);
        }
        return false;
      })
      .map((linha) => ({ ...linha }));
    return { ...pagina, linhas };
  });

  const totalCaracteres = paginas.reduce(
    (soma, pagina) => soma + pagina.linhas.reduce((s, linha) => s + linha.texto.length, 0),
    0,
  );

  return {
    documento: { paginas, totalCaracteres, escaneado: doc.escaneado },
    removidas,
  };
}
