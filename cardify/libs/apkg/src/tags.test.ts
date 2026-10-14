import { nomeDeckDaNota, tagsDaNota } from './tags';

describe('tagsDaNota', () => {
  it('sem trilha gera só a tag do documento', () => {
    expect(tagsDaNota('fisiologia', [], [])).toEqual(['cardify::fisiologia']);
  });

  it('com trilha acrescenta a tag da última seção, com slug', () => {
    expect(tagsDaNota('fisiologia', ['Cardio', 'Ciclo cardíaco'], [])).toEqual([
      'cardify::fisiologia',
      'cardify::fisiologia::ciclo-cardiaco',
    ]);
  });

  it('troca espaços das tags extras por _', () => {
    expect(tagsDaNota('fisiologia', [], ['revisar depois', 'prova  final'])).toEqual([
      'cardify::fisiologia',
      'revisar_depois',
      'prova_final',
    ]);
  });

  it('descarta tags extras vazias', () => {
    expect(tagsDaNota('fisiologia', [], ['', '   '])).toEqual(['cardify::fisiologia']);
  });

  it('remove duplicatas, inclusive ignorando maiúsculas', () => {
    expect(tagsDaNota('fisiologia', ['Cardio'], ['Revisar', 'revisar', 'cardify::fisiologia'])).toEqual([
      'cardify::fisiologia',
      'cardify::fisiologia::cardio',
      'Revisar',
    ]);
  });
});

describe('nomeDeckDaNota', () => {
  it('monta o deck com até 3 níveis da trilha', () => {
    expect(nomeDeckDaNota('Fisiologia', ['Cardio', 'Ciclo cardíaco', 'Sístole', 'Fase 1'])).toBe(
      'Fisiologia::Cardio::Ciclo cardíaco::Sístole',
    );
  });

  it('sem trilha usa só o nome do baralho', () => {
    expect(nomeDeckDaNota('Fisiologia', [])).toBe('Fisiologia');
  });

  it('sanitiza partes: trim, colapsa espaços, troca :: por : e remove aspas', () => {
    expect(nomeDeckDaNota('Fisiologia', ['  Cardio   vascular ', 'A::B', 'Say "hi"'])).toBe(
      'Fisiologia::Cardio vascular::A:B::Say hi',
    );
  });

  it('descarta partes vazias sem gastar um nível', () => {
    expect(nomeDeckDaNota('Fisiologia', ['', 'Cardio', '   ', 'Sístole', 'Fase 1'])).toBe(
      'Fisiologia::Cardio::Sístole::Fase 1',
    );
  });

  it('sanitiza também o nome do baralho raiz', () => {
    expect(nomeDeckDaNota('Anatomia::Básica', [])).toBe('Anatomia:Básica');
  });
});
