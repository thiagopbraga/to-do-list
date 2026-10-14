import type { DocumentoExtraido, LinhaPdf, PaginaPdf } from '@cardify/shared';
import { limparRuidoEstrutural } from './limpeza';

function linha(texto: string, yNorm: number): LinhaPdf {
  return { texto, fonteTamanho: 10, negrito: false, yNorm, xNorm: 0.1 };
}

function pagina(n: number, linhas: Array<[string, number]>): PaginaPdf {
  return { numero: n, largura: 595, altura: 842, linhas: linhas.map(([t, y]) => linha(t, y)) };
}

function documento(paginas: PaginaPdf[], escaneado = false): DocumentoExtraido {
  const totalCaracteres = paginas.reduce(
    (soma, p) => soma + p.linhas.reduce((s, l) => s + l.texto.length, 0),
    0,
  );
  return { paginas, totalCaracteres, escaneado };
}

function textos(doc: DocumentoExtraido, n: number): string[] {
  return doc.paginas[n - 1].linhas.map((l) => l.texto);
}

describe('limparRuidoEstrutural', () => {
  it('remove cabeçalho idêntico em todas as páginas e mantém corpo idêntico no meio', () => {
    const doc = documento(
      [1, 2, 3, 4, 5].map((n) =>
        pagina(n, [
          ['Aula de Fisiologia', 0.03],
          ['Ciclo cardíaco', 0.5],
          [`Conteúdo específico ${n}`, 0.6],
        ]),
      ),
    );

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual(['aula de fisiologia']);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(textos(resultado.documento, n)).toEqual(['Ciclo cardíaco', `Conteúdo específico ${n}`]);
    }
  });

  it('remove rodapé de numeração que varia o número da página', () => {
    const doc = documento(
      [1, 2, 3, 4, 5].map((n) =>
        pagina(n, [
          ['Corpo da página', 0.4],
          [`Página ${n} de 5`, 0.95],
        ]),
      ),
    );

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual(['pagina de']);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(textos(resultado.documento, n)).toEqual(['Corpo da página']);
    }
  });

  it('trata marca d\'água com acento e caixa diferentes como a mesma linha', () => {
    const variantes = ['Material CURSINHO Aprova', 'material cursinho aprová', 'MATERIAL cursinho APROVA', 'Material Cursinho Aprová'];
    const doc = documento(
      [0, 1, 2, 3, 4].map((i) =>
        pagina(i + 1, [
          [variantes[i % variantes.length], 0.02],
          ['Texto de estudo', 0.5],
        ]),
      ),
    );

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual(['material cursinho aprova']);
    expect(resultado.documento.paginas.every((p) => p.linhas.length === 1)).toBe(true);
  });

  it('exige mais de 60% das páginas: 3 de 5 não remove, 4 de 5 remove', () => {
    const cabecalho = (n: number, presente: boolean): PaginaPdf =>
      pagina(n, presente ? [['Cursinho X', 0.04], ['corpo', 0.5]] : [['corpo', 0.5]]);

    const tres = documento([1, 2, 3, 4, 5].map((n) => cabecalho(n, n <= 3)));
    const quatro = documento([1, 2, 3, 4, 5].map((n) => cabecalho(n, n <= 4)));

    const r3 = limparRuidoEstrutural(tres);
    expect(r3.removidas).toEqual([]);
    expect(textos(r3.documento, 1)).toEqual(['Cursinho X', 'corpo']);

    const r4 = limparRuidoEstrutural(quatro);
    expect(r4.removidas).toEqual(['cursinho x']);
    expect(textos(r4.documento, 1)).toEqual(['corpo']);
    expect(textos(r4.documento, 5)).toEqual(['corpo']);
  });

  it('não remove nada em documento de 1 página', () => {
    const doc = documento([pagina(1, [['Cabeçalho', 0.02], ['Página 1', 0.97], ['corpo', 0.5]])]);

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual([]);
    expect(resultado.documento.paginas).toEqual(doc.paginas);
    expect(resultado.documento.totalCaracteres).toBe(doc.totalCaracteres);
  });

  it('exige presença em todas as páginas quando o documento tem 2', () => {
    const doc = documento([
      pagina(1, [['Cabeçalho', 0.02]]),
      pagina(2, [['corpo', 0.5]]),
    ]);
    expect(limparRuidoEstrutural(doc).removidas).toEqual([]);

    const ambas = documento([pagina(1, [['Cabeçalho', 0.02]]), pagina(2, [['Cabeçalho', 0.02]])]);
    expect(limparRuidoEstrutural(ambas).removidas).toEqual(['cabecalho']);
  });

  it('conta página distinta: a mesma linha repetida 3x numa página vale 1', () => {
    const doc = documento([
      pagina(1, [['Rascunho', 0.02], ['Rascunho', 0.03], ['Rascunho', 0.04], ['corpo', 0.5]]),
      pagina(2, [['Rascunho', 0.02], ['corpo', 0.5]]),
      pagina(3, [['Rascunho', 0.02], ['corpo', 0.5]]),
      pagina(4, [['corpo', 0.5]]),
      pagina(5, [['corpo', 0.5]]),
    ]);

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual([]);
    expect(textos(resultado.documento, 1)).toHaveLength(4);
  });

  it('nunca remove linhas fora das faixas de 8% do topo e do rodapé', () => {
    const doc = documento([1, 2, 3, 4, 5].map((n) => pagina(n, [['Quase topo', 0.09], ['Quase rodapé', 0.91]])));

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual([]);
    expect(textos(resultado.documento, 1)).toEqual(['Quase topo', 'Quase rodapé']);
  });

  it('separa topo e rodapé: a mesma chave em faixas diferentes conta separado', () => {
    const doc = documento([
      pagina(1, [['Nota', 0.02]]),
      pagina(2, [['Nota', 0.02]]),
      pagina(3, [['Nota', 0.95]]),
      pagina(4, [['Nota', 0.95]]),
      pagina(5, [['Nota', 0.5]]),
    ]);

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual([]);
    expect(resultado.documento.paginas.flatMap((p) => p.linhas)).toHaveLength(5);
  });

  it('número solto na faixa vira chave vazia e é removido', () => {
    const doc = documento([1, 2, 3, 4, 5].map((n) => pagina(n, [['corpo', 0.5], [String(n * 7), 0.96]])));

    const resultado = limparRuidoEstrutural(doc);

    expect(resultado.removidas).toEqual(['']);
    expect(resultado.documento.paginas.every((p) => p.linhas.map((l) => l.texto).join() === 'corpo')).toBe(true);
  });

  it('não muta a entrada, recalcula totalCaracteres e preserva escaneado', () => {
    const doc = documento(
      [1, 2, 3, 4, 5].map((n) => pagina(n, [['Cabeçalho longo da turma', 0.02], ['corpo', 0.5]])),
      true,
    );
    const antes = structuredClone(doc);
    const totalAntes = doc.totalCaracteres;

    const resultado = limparRuidoEstrutural(doc);

    expect(doc).toEqual(antes);
    expect(resultado.documento).not.toBe(doc);
    expect(resultado.documento.paginas).not.toBe(doc.paginas);
    expect(resultado.documento.paginas[0].linhas[0]).not.toBe(doc.paginas[0].linhas[0]);
    expect(resultado.documento.escaneado).toBe(true);
    expect(resultado.documento.totalCaracteres).toBe(5 * 'corpo'.length);
    expect(resultado.documento.totalCaracteres).not.toBe(totalAntes);
  });
});
