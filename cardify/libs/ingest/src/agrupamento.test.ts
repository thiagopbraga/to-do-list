import { agruparLinhas, type ItemTexto } from './agrupamento';

const ALTURA = 800;
const LARGURA = 600;

function item(str: string, x: number, y: number, extra: Partial<ItemTexto> = {}): ItemTexto {
  return { str, x, y, fonteTamanho: 10, largura: str.length * 5, negrito: false, ...extra };
}

const textos = (itens: ItemTexto[]) => agruparLinhas(itens, ALTURA, LARGURA).map((l) => l.texto);

describe('agruparLinhas', () => {
  it('une uma palavra partida em dois itens sem gap', () => {
    expect(textos([item('Cardio', 50, 700), item('vascular', 80, 700)])).toEqual(['Cardiovascular']);
  });

  it('insere espaço quando o gap excede 25% da largura média do glifo', () => {
    expect(textos([item('o coração', 50, 700), item('bombeia', 50 + 45 + 3, 700)])).toEqual(['o coração bombeia']);
  });

  it('não insere espaço para gap pequeno ou sobreposição (kerning)', () => {
    expect(textos([item('AB', 50, 700), item('CD', 59.5, 700), item('EF', 69, 700)])).toEqual(['ABCDEF']);
  });

  it('respeita um item " " explícito mesmo sem gap', () => {
    expect(textos([item('pressão', 50, 700), item(' ', 85, 700, { largura: 0 }), item('arterial', 85, 700)])).toEqual(['pressão arterial']);
  });

  it('ignora itens vazios ou só de espaço isolados', () => {
    expect(textos([item('', 10, 700), item('   ', 10, 650), item('texto', 50, 600)])).toEqual(['texto']);
  });

  it('não junta linhas próximas separadas por mais de meia altura de linha', () => {
    expect(textos([item('primeira', 50, 700), item('segunda', 50, 688)])).toEqual(['primeira', 'segunda']);
  });

  it('junta itens com pequena variação de y na mesma linha', () => {
    expect(textos([item('baixo', 50, 699), item('alto', 80, 700)])).toEqual(['baixo alto']);
  });

  it('ordena linhas de cima para baixo e itens da esquerda para a direita independentemente da ordem de entrada', () => {
    const itens = [item('mundo', 80, 500), item('fim', 50, 300), item('olá', 50, 500), item('topo', 50, 700)];
    expect(textos(itens)).toEqual(['topo', 'olá mundo', 'fim']);
  });

  it('colapsa espaços e faz trim', () => {
    expect(textos([item('  a   b ', 50, 700), item('c  ', 100, 700)])).toEqual(['a b c']);
  });

  it('usa o tamanho do item com mais caracteres e a maioria dos caracteres para negrito', () => {
    const [linha] = agruparLinhas(
      [
        item('Título', 50, 700, { fonteTamanho: 14.04, negrito: true }),
        item(' comum com texto longo', 90, 700, { fonteTamanho: 10 }),
      ],
      ALTURA,
      LARGURA,
    );
    expect(linha?.fonteTamanho).toBe(10);
    expect(linha?.negrito).toBe(false);

    const [titulo] = agruparLinhas([item('Título longo', 50, 700, { fonteTamanho: 14.04, negrito: true }), item('x', 140, 700)], ALTURA, LARGURA);
    expect(titulo?.fonteTamanho).toBe(14);
    expect(titulo?.negrito).toBe(true);
  });

  it('calcula yNorm pelo topo da linha (0 = topo) e xNorm pelo primeiro item', () => {
    const [linha] = agruparLinhas([item('a', 150, 700, { fonteTamanho: 20 })], ALTURA, LARGURA);
    expect(linha?.yNorm).toBeCloseTo(1 - 720 / ALTURA, 10);
    expect(linha?.xNorm).toBeCloseTo(0.25, 10);
  });

  it('limita yNorm e xNorm a [0, 1]', () => {
    const [acima] = agruparLinhas([item('a', -10, 795)], ALTURA, LARGURA);
    expect(acima?.yNorm).toBe(0);
    expect(acima?.xNorm).toBe(0);
    const [abaixo] = agruparLinhas([item('a', 700, -30)], ALTURA, LARGURA);
    expect(abaixo?.yNorm).toBe(1);
    expect(abaixo?.xNorm).toBe(1);
  });

  it('devolve lista vazia sem itens', () => {
    expect(agruparLinhas([], ALTURA, LARGURA)).toEqual([]);
  });
});
