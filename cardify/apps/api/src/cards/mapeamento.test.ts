import type { CardRow } from '@cardify/db';
import { CardRevisaoSchema } from '@cardify/shared';
import { nomeDoBaralho, paraCardRevisao, paraNotaExportavel } from './mapeamento';

const atualizadoEm = new Date('2026-05-01T10:00:00Z');

const linha: CardRow = {
  id: '3f1c2b4e-1111-4222-8333-444455556666',
  jobId: '9a8b7c6d-1111-4222-8333-444455556666',
  chunkId: null,
  tipo: 'cloze',
  frente: 'O coração bombeia sangue',
  verso: 'bombeia',
  textoCloze: 'O coração {{c1::bombeia}} sangue',
  tags: ['cardio'],
  trilhaTitulos: ['Fisiologia', 'Cardiovascular'],
  fonteOffset: 42,
  estado: 'editado',
  ordem: 3,
  substituiCardId: null,
  createdAt: new Date('2026-04-01T10:00:00Z'),
  updatedAt: atualizadoEm,
};

describe('paraCardRevisao', () => {
  it('devolve exatamente o formato CardRevisao, sem campos internos do banco', () => {
    const cartao = paraCardRevisao(linha);
    expect(CardRevisaoSchema.safeParse(cartao).success).toBe(true);
    expect(cartao).not.toHaveProperty('updatedAt');
    expect(cartao).not.toHaveProperty('substituiCardId');
    expect(cartao).toEqual({
      id: linha.id,
      jobId: linha.jobId,
      chunkId: null,
      tipo: 'cloze',
      frente: 'O coração bombeia sangue',
      verso: 'bombeia',
      textoCloze: 'O coração {{c1::bombeia}} sangue',
      tags: ['cardio'],
      trilhaTitulos: ['Fisiologia', 'Cardiovascular'],
      fonteOffset: 42,
      estado: 'editado',
      ordem: 3,
    });
  });
});

describe('paraNotaExportavel', () => {
  it('usa updatedAt como atualizadoEm, que vira o mod da nota no Anki', () => {
    const nota = paraNotaExportavel(linha);
    expect(nota.atualizadoEm).toBe(atualizadoEm);
    expect(nota).toMatchObject({
      id: linha.id,
      tipo: 'cloze',
      textoCloze: 'O coração {{c1::bombeia}} sangue',
      trilhaTitulos: ['Fisiologia', 'Cardiovascular'],
      tags: ['cardio'],
      ordem: 3,
    });
  });
});

describe('nomeDoBaralho', () => {
  it('remove a extensão do nome do documento', () => {
    expect(nomeDoBaralho('Aula de Fisiologia.pdf')).toBe('Aula de Fisiologia');
    expect(nomeDoBaralho('resumo.final.docx')).toBe('resumo.final');
  });

  it('cai para Cardify quando não sobra nome', () => {
    expect(nomeDoBaralho(null)).toBe('Cardify');
    expect(nomeDoBaralho(undefined)).toBe('Cardify');
    expect(nomeDoBaralho('')).toBe('Cardify');
    expect(nomeDoBaralho('.pdf')).toBe('Cardify');
  });

  it('mantém nomes sem extensão', () => {
    expect(nomeDoBaralho('Texto colado')).toBe('Texto colado');
  });
});
