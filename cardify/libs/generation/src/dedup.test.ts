import { deduplicarCards } from './dedup';

type Card = { id: string; frente: string; verso: string };

const card = (id: string, frente: string, verso: string): Card => ({ id, frente, verso });
const ids = (cards: Card[]) => cards.map((c) => c.id);

describe('deduplicarCards', () => {
  it('trata frentes iguais em acento, caixa e pontuação como duplicatas e mantém o verso mais curto', () => {
    const cards = [
      card('a', 'Qual é a função da mitocôndria na célula?', 'Produz energia celular por respiração e fosforilação oxidativa.'),
      card('b', 'FUNÇÃO da MITOCÔNDRIA, na célula!', 'Gera ATP.'),
    ];

    const r = deduplicarCards(cards);

    expect(ids(r.mantidos)).toEqual(['b']);
    expect(ids(r.removidos)).toEqual(['a']);
  });

  it('considera stopwords irrelevantes para a duplicata', () => {
    const cards = [
      card('a', 'Qual é a função do nó sinoatrial?', 'Marca-passo natural do coração.'),
      card('b', 'Função do nó sinoatrial?', 'Marca-passo.'),
    ];

    const r = deduplicarCards(cards);

    expect(ids(r.mantidos)).toEqual(['b']);
    expect(ids(r.removidos)).toEqual(['a']);
  });

  it('mantém cards com assuntos diferentes', () => {
    const cards = [
      card('a', 'Qual é a função do nó sinoatrial?', 'Marca-passo natural do coração.'),
      card('c', 'Qual é a função da válvula mitral?', 'Separa átrio esquerdo do ventrículo.'),
    ];

    const r = deduplicarCards(cards);

    expect(ids(r.mantidos)).toEqual(['a', 'c']);
    expect(r.removidos).toEqual([]);
  });

  it('não trata negação como stopword: cards com e sem "não" são mantidos', () => {
    const cards = [
      card('a', 'O que não é permitido ao contribuinte?', 'Deduzir despesas pessoais.'),
      card('b', 'O que é permitido ao contribuinte?', 'Deduzir despesas médicas.'),
    ];

    const r = deduplicarCards(cards);

    expect(ids(r.mantidos)).toEqual(['a', 'b']);
    expect(r.removidos).toEqual([]);
  });

  it('o substituto ocupa a posição do card removido em mantidos', () => {
    const cards = [
      card('x', 'Hemácias transportam oxigênio', 'Oxigênio aos tecidos.'),
      card('d1', 'Qual é a função do ventrículo esquerdo?', 'Bombear sangue oxigenado para a aorta.'),
      card('y', 'Nefrons filtram o plasma sanguíneo', 'Filtragem glomerular.'),
      card('d2', 'Função do ventrículo esquerdo', 'Bombear sangue.'),
    ];

    const r = deduplicarCards(cards);

    expect(ids(r.mantidos)).toEqual(['x', 'd2', 'y']);
    expect(r.mantidos[1]).toBe(cards[3]);
    expect(ids(r.removidos)).toEqual(['d1']);
  });

  it('respeita o limiar informado (Jaccard de 0,5 entre os dois cards)', () => {
    // shingles a: {sistole ventricular fase, ventricular fase contracao, fase contracao cardiaca}
    // shingles b: {sistole ventricular fase, ventricular fase contracao, fase contracao diastole}
    // intersecção = 2, união = 4 → Jaccard = 0,5
    const cards = [
      card('a', 'Sístole ventricular fase contração cardíaca', 'Contração do ventrículo para ejetar sangue.'),
      card('b', 'Sístole ventricular fase contração diástole', 'Ejetar sangue.'),
    ];

    expect(ids(deduplicarCards(cards).mantidos)).toEqual(['a', 'b']);
    expect(ids(deduplicarCards(cards, 0.6).mantidos)).toEqual(['a', 'b']);

    const r = deduplicarCards(cards, 0.5);
    expect(ids(r.mantidos)).toEqual(['b']);
    expect(ids(r.removidos)).toEqual(['a']);
  });

  it('lista vazia devolve listas vazias', () => {
    expect(deduplicarCards([])).toEqual({ mantidos: [], removidos: [] });
  });

  it('lista com um card devolve esse card em mantidos', () => {
    const c = card('a', 'Qual é a função do rim?', 'Filtrar o sangue.');

    expect(deduplicarCards([c])).toEqual({ mantidos: [c], removidos: [] });
  });

  it('frentes sem conteúdo após normalização não são deduplicadas entre si', () => {
    const cards = [card('p', '?', 'x'), card('q', '!', 'yy')];

    const r = deduplicarCards(cards);

    expect(ids(r.mantidos)).toEqual(['p', 'q']);
    expect(r.removidos).toEqual([]);
  });

  it('não altera a lista de entrada', () => {
    const cards = [
      card('a', 'Qual é a função da mitocôndria na célula?', 'Produz energia celular por respiração.'),
      card('b', 'Função da mitocôndria na célula', 'Gera ATP.'),
    ];
    const copia = structuredClone(cards);

    deduplicarCards(cards);

    expect(cards).toEqual(copia);
  });
});
