/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de teste sem tipo */
import { RespostaExtracaoSchema, RespostaGeracaoSchema } from '@cardify/shared';
import { FakeLlmProvider } from './fake';
import { paraJsonSchema } from './json-schema';


const DOC =
  'Curto demais. A mitocôndria é a organela responsável pela respiração celular. ' +
  'O corpo humano tem 206 ossos no total! Os tipos incluem vermelho, azul, amarelo e verde. ' +
  'Plantas absorvem luz solar durante o dia?';

const base = { tier: 'economico' as const, sistema: 's', maxTokens: 1000 };

describe('FakeLlmProvider', () => {
  it('extrai fatos conforme as convenções', async () => {
    const p = new FakeLlmProvider();
    const r = await p.completar({
      ...base,
      jsonSchema: paraJsonSchema(RespostaExtracaoSchema),
      mensagens: [{ papel: 'user', conteudo: `<documento>${DOC}</documento>` }],
    });
    const { fatos } = JSON.parse(r.texto);
    expect(fatos.map((f: any) => f.categoria)).toEqual(['definicao', 'numero', 'enumeracao', 'relacao']);
    expect(fatos[0].afirmacao).toBe('A mitocôndria é a organela responsável pela respiração celular.');
    for (const f of fatos) expect(DOC.slice(f.fonteOffset, f.fonteOffset + f.afirmacao.length)).toBe(f.afirmacao);
    expect(r.modelo).toBe('fake-economico');
    expect(RespostaExtracaoSchema.safeParse({ fatos }).success).toBe(true);
  });

  it('gera cards misto alternando básico/cloze e válidos no schema', async () => {
    const fatos = [
      { afirmacao: 'A mitocôndria é a organela responsável pela respiração celular.', categoria: 'definicao', fonteOffset: 10 },
      { afirmacao: 'O corpo humano tem 206 ossos no total!', categoria: 'numero', fonteOffset: 90 },
    ];
    const p = new FakeLlmProvider();
    const r = await p.completar({
      ...base,
      tier: 'forte',
      jsonSchema: paraJsonSchema(RespostaGeracaoSchema),
      mensagens: [
        { papel: 'user', conteudo: `<fatos>${JSON.stringify(fatos)}</fatos><secao>Biologia</secao>` },
      ],
    });
    const { cards } = JSON.parse(r.texto);
    expect(r.modelo).toBe('fake-forte');
    expect(cards[0]).toEqual({
      tipo: 'basico',
      frente: 'Sobre "A mitocôndria é a organela responsável...": o que o material afirma?',
      verso: fatos[0]!.afirmacao,
      textoCloze: null,
      tagSecao: 'Biologia',
      fonteOffset: 10,
    });
    expect(cards[1].tipo).toBe('cloze');
    expect(cards[1].verso).toBe('humano');
    expect(cards[1].textoCloze).toBe('O corpo {{c1::humano}} tem 206 ossos no total!');
    expect(RespostaGeracaoSchema.safeParse({ cards }).success).toBe(true);
  });

  it('respeita preferencia_tipo cloze', async () => {
    const fatos = [{ afirmacao: 'A fotossíntese ocorre nos cloroplastos.', categoria: 'relacao', fonteOffset: 0 }];
    const r = await new FakeLlmProvider().completar({
      ...base,
      jsonSchema: { properties: { cards: {} } },
      mensagens: [{ papel: 'user', conteudo: `<fatos>${JSON.stringify(fatos)}</fatos><preferencia_tipo>cloze</preferencia_tipo>` }],
    });
    const { cards } = JSON.parse(r.texto);
    expect(cards[0].tipo).toBe('cloze');
    expect(cards[0].verso).toBe('fotossíntese');
    expect(cards[0].tagSecao).toBe('');
  });

  it('sem schema conhecido devolve ok; tokens = ceil(chars/4)', async () => {
    const r = await new FakeLlmProvider({ latenciaMs: 7 }).completar({ ...base, sistema: 'abcde', mensagens: [{ papel: 'user', conteudo: 'abc' }] });
    expect(r).toMatchObject({ texto: 'ok', tokensIn: 2, latenciaMs: 7 });
  });

  it('consome a fila de respostas e depois volta ao determinístico', async () => {
    const p = new FakeLlmProvider({ respostas: ['a', 'b'] });
    const m = [{ papel: 'user' as const, conteudo: 'x' }];
    expect((await p.completar({ ...base, mensagens: m })).texto).toBe('a');
    expect((await p.completar({ ...base, mensagens: m })).texto).toBe('b');
    expect((await p.completar({ ...base, mensagens: m })).texto).toBe('ok');
  });
});
