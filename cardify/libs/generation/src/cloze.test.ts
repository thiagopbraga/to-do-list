import { removerMarcacaoCloze, validarCloze, type ResultadoCloze } from './cloze';

const casos: Array<{ descricao: string; texto: string; esperado: ResultadoCloze }> = [
  {
    descricao: 'válido com duas oclusões e dica em uma delas',
    texto: 'A {{c1::aorta::vaso}} sai do {{c2::ventrículo esquerdo}} e leva sangue ao corpo inteiro.',
    esperado: { ok: true, indices: [1, 2] },
  },
  {
    descricao: 'válido com termo técnico e acentos',
    texto: 'O {{c1::nó sinoatrial}} é o marca-passo fisiológico do coração.',
    esperado: { ok: true, indices: [1] },
  },
  {
    descricao: 'válido com dica simples',
    texto: 'O {{c1::DNA::ácido nucleico}} carrega a informação genética da célula.',
    esperado: { ok: true, indices: [1] },
  },
  {
    descricao: 'válido com conteúdo cercado de espaços',
    texto: 'O {{c1::  rim  }} filtra o sangue e produz a urina.',
    esperado: { ok: true, indices: [1] },
  },
  {
    descricao: 'válido com três oclusões contíguas',
    texto: '{{c1::Lisboa}} é capital de {{c2::Portugal}}, enquanto {{c3::Madri}} é capital da Espanha.',
    esperado: { ok: true, indices: [1, 2, 3] },
  },
  {
    descricao: 'válido com oclusões fora de ordem no texto',
    texto: '{{c2::Portugal}} tem como capital a cidade de {{c1::Lisboa}}, banhada pelo Tejo.',
    esperado: { ok: true, indices: [1, 2] },
  },
  {
    descricao: 'válido com índice c1 repetido (mesmo card no Anki)',
    texto: 'A capital do Brasil é {{c1::Brasília}}, fundada em 1960, e {{c1::Brasília}} abriga o Congresso.',
    esperado: { ok: true, indices: [1] },
  },
  {
    descricao: 'válido com exatamente 15 caracteres de contexto',
    texto: 'ABCDEFGHIJKLMNO {{c1::resposta}}',
    esperado: { ok: true, indices: [1] },
  },
  {
    descricao: 'sem oclusão',
    texto: 'A aorta sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'sem_oclusao' },
  },
  {
    descricao: 'texto vazio não tem oclusão',
    texto: '',
    esperado: { ok: false, motivo: 'sem_oclusao' },
  },
  {
    descricao: 'chave de fechamento faltando',
    texto: 'A {{c1::aorta::vaso sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'chaves_desbalanceadas' },
  },
  {
    descricao: 'chave extra colada na oclusão',
    texto: 'A {{c1::aorta}}} sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'chaves_desbalanceadas' },
  },
  {
    descricao: 'chave solta no meio do texto',
    texto: 'A {{c1::aorta}} sai do } ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'chaves_desbalanceadas' },
  },
  {
    descricao: 'chave aberta extra antes da oclusão',
    texto: '{{{c1::aorta}} sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'chaves_desbalanceadas' },
  },
  {
    descricao: 'conteúdo ocluído vazio',
    texto: 'A {{c1::}} sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'oclusao_vazia' },
  },
  {
    descricao: 'conteúdo ocluído só com espaços',
    texto: 'A {{c1::   }} sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'oclusao_vazia' },
  },
  {
    descricao: 'índice pulado (c1 e c3)',
    texto: 'A {{c1::aorta}} sai do {{c3::ventrículo}} esquerdo do coração.',
    esperado: { ok: false, motivo: 'indices_nao_contiguos' },
  },
  {
    descricao: 'começa em c2 sem c1',
    texto: 'A {{c2::aorta}} sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'indices_nao_contiguos' },
  },
  {
    descricao: 'índice zero',
    texto: 'A {{c0::aorta}} sai do ventrículo esquerdo do coração.',
    esperado: { ok: false, motivo: 'indices_nao_contiguos' },
  },
  {
    descricao: 'frase inteira ocluída',
    texto: '{{c1::O coração bombeia o sangue pelo corpo.}}',
    esperado: { ok: false, motivo: 'oclusao_frase_inteira' },
  },
  {
    descricao: 'frase inteira dividida em duas oclusões',
    texto: '{{c1::O coração bombeia}} {{c2::o sangue pelo corpo.}}',
    esperado: { ok: false, motivo: 'oclusao_frase_inteira' },
  },
  {
    descricao: 'pouco contexto com uma oclusão',
    texto: 'A {{c1::aorta}} sai do {{c2::coração}}.',
    esperado: { ok: false, motivo: 'pouco_contexto' },
  },
  {
    descricao: 'pouco contexto: dica não conta como contexto',
    texto: 'Ok {{c1::aorta::órgão principal do corpo humano}} fim.',
    esperado: { ok: false, motivo: 'pouco_contexto' },
  },
  {
    descricao: 'pouco contexto com 14 caracteres',
    texto: 'ABCDEFGHIJKLMN {{c1::resposta}}',
    esperado: { ok: false, motivo: 'pouco_contexto' },
  },
];

describe('validarCloze', () => {
  it.each(casos)('$descricao', ({ texto, esperado }) => {
    expect(validarCloze(texto)).toEqual(esperado);
  });

  it('retorna o mesmo resultado em chamadas consecutivas (sem vazamento de lastIndex)', () => {
    const valido = 'A {{c1::aorta::vaso}} sai do {{c2::ventrículo esquerdo}} e leva sangue ao corpo inteiro.';
    const invalido = 'A {{c1::aorta}} sai do {{c3::ventrículo}} esquerdo do coração.';
    const primeiro = validarCloze(valido);
    expect(validarCloze(invalido)).toEqual({ ok: false, motivo: 'indices_nao_contiguos' });
    expect(validarCloze(valido)).toEqual(primeiro);
    expect(validarCloze(valido)).toEqual(primeiro);
  });
});

describe('removerMarcacaoCloze', () => {
  it('troca cada oclusão pelo conteúdo e descarta a dica', () => {
    expect(removerMarcacaoCloze('A {{c1::aorta::vaso}} sai do {{c2::ventrículo esquerdo}}.')).toBe(
      'A aorta sai do ventrículo esquerdo.',
    );
  });

  it('é o inverso da marcação para texto válido com dica', () => {
    const marcado = 'A {{c1::aorta::vaso}} sai do {{c2::ventrículo esquerdo}} e leva sangue ao corpo inteiro.';
    expect(removerMarcacaoCloze(marcado)).toBe('A aorta sai do ventrículo esquerdo e leva sangue ao corpo inteiro.');
  });

  it('mantém texto sem marcação intacto', () => {
    expect(removerMarcacaoCloze('Texto sem marcação.')).toBe('Texto sem marcação.');
  });

  it('pode ser chamada várias vezes sobre o mesmo texto', () => {
    const texto = '{{c1::Lisboa}} e {{c2::Porto}}';
    expect(removerMarcacaoCloze(texto)).toBe('Lisboa e Porto');
    expect(removerMarcacaoCloze(texto)).toBe('Lisboa e Porto');
  });
});
