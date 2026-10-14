import type { NotaExportavel, PacoteBaralho } from '@cardify/shared';
import { exportarDelimitado } from './delimitado';
import { guidDoCard } from './packer';

const ID = '00000000-0000-4000-8000-000000000001';

function nota(parcial: Partial<NotaExportavel> = {}): NotaExportavel {
  return {
    id: ID,
    tipo: 'basico',
    frente: 'Frente',
    verso: 'Verso',
    textoCloze: null,
    trilhaTitulos: [],
    tags: [],
    ordem: 0,
    ...parcial,
  };
}

function pacote(notas: NotaExportavel[], parcial: Partial<PacoteBaralho> = {}): PacoteBaralho {
  return { nomeBaralho: 'Fisiologia', slugDocumento: 'fisiologia', notas, ...parcial };
}

/** Linhas de dados sem a última coluna (GUID), cortando no último separador fora de aspas. */
function dados(saida: string): string[] {
  return saida
    .split('\n')
    .filter((linha) => linha !== '' && !linha.startsWith('#'))
    .map(semUltimaColuna);
}

function semUltimaColuna(linha: string): string {
  let emAspas = false;
  let ultimo = -1;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') emAspas = !emAspas;
    else if (!emAspas && (c === ',' || c === '\t')) ultimo = i;
  }
  return linha.slice(0, ultimo);
}

/** Parser mínimo RFC 4180 para o teste de ida e volta. Aspas dobradas viram aspas; o texto deve terminar em \n. */
function parseDelimitado(texto: string, separador: ',' | '\t'): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let emAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (emAspas) {
      if (c !== '"') campo += c;
      else if (texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else emAspas = false;
    } else if (c === '"') emAspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n') {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  return linhas;
}

const ENTIDADES: Record<string, string> = { '<br>': '\n', '&lt;': '<', '&gt;': '>', '&amp;': '&' };
const desfazerHtml = (texto: string) => texto.replace(/<br>|&lt;|&gt;|&amp;/g, (m) => ENTIDADES[m] ?? m);

describe('exportarDelimitado: cabeçalho', () => {
  it('CSV declara separador Comma e as colunas separadas por vírgula', () => {
    const saida = exportarDelimitado(pacote([]), ',');
    expect(saida).toBe(
      [
        '#separator:Comma',
        '#html:true',
        '#notetype column:1',
        '#deck column:2',
        '#tags column:5',
        '#guid column:6',
        '#columns:Note type,Deck,Front/Text,Back,Tags,GUID',
        '',
      ].join('\n'),
    );
  });

  it('TSV declara separador Tab e as colunas separadas por tab', () => {
    const saida = exportarDelimitado(pacote([]), '\t');
    expect(saida).toBe(
      [
        '#separator:Tab',
        '#html:true',
        '#notetype column:1',
        '#deck column:2',
        '#tags column:5',
        '#guid column:6',
        '#columns:Note type\tDeck\tFront/Text\tBack\tTags\tGUID',
        '',
      ].join('\n'),
    );
  });

  it('termina com \\n e não tem BOM', () => {
    const saida = exportarDelimitado(pacote([nota()]), ',');
    expect(saida.endsWith('\n')).toBe(true);
    expect(saida.startsWith('﻿')).toBe(false);
  });
});

describe('exportarDelimitado: linhas', () => {
  it('última coluna é o mesmo GUID do .apkg, para reimportar atualizando', () => {
    for (const separador of [',', '\t'] as const) {
      const [linha] = parseDelimitado(exportarDelimitado(pacote([nota()]), separador).split('\n').filter((l) => !l.startsWith('#')).join('\n'), separador);
      expect(linha).toHaveLength(6);
      expect(linha[5]).toBe(guidDoCard(ID));
    }
  });

  it('básico: note type, deck, frente, verso e tags', () => {
    expect(dados(exportarDelimitado(pacote([nota()]), ','))).toEqual([
      'Cardify Básico,Fisiologia,Frente,Verso,cardify::fisiologia',
    ]);
  });

  it('cloze: frente é o textoCloze com marcação preservada e verso vazio', () => {
    const cloze = nota({
      tipo: 'cloze',
      textoCloze: 'O coração tem {{c1::quatro}} câmaras',
      verso: 'ignorado',
      trilhaTitulos: ['Cardio'],
    });
    expect(dados(exportarDelimitado(pacote([cloze]), ','))).toEqual([
      'Cardify Cloze,Fisiologia::Cardio,O coração tem {{c1::quatro}} câmaras,,cardify::fisiologia cardify::fisiologia::cardio',
    ]);
  });

  it('cloze sem textoCloze lança erro', () => {
    const semTexto = nota({ tipo: 'cloze', textoCloze: null });
    expect(() => exportarDelimitado(pacote([semTexto]), ',')).toThrow(/cloze sem textoCloze/);
    const vazio = nota({ tipo: 'cloze', textoCloze: '   ' });
    expect(() => exportarDelimitado(pacote([vazio]), '\t')).toThrow(/cloze sem textoCloze/);
  });

  it('ordena as notas pelo campo ordem', () => {
    const notas = [
      nota({ frente: 'terceira', ordem: 2 }),
      nota({ frente: 'primeira', ordem: 0 }),
      nota({ frente: 'segunda', ordem: 1 }),
    ];
    expect(dados(exportarDelimitado(pacote(notas), ',')).map((l) => l.split(',')[2])).toEqual([
      'primeira',
      'segunda',
      'terceira',
    ]);
  });

  it('deck com 4 níveis de trilha é truncado em 3', () => {
    const profunda = nota({ trilhaTitulos: ['Cardio', 'Ciclo cardíaco', 'Sístole', 'Fase 1'] });
    expect(dados(exportarDelimitado(pacote([profunda]), ','))[0]).toContain(
      ',Fisiologia::Cardio::Ciclo cardíaco::Sístole,',
    );
  });

  it('tags extras com espaço saem com _ na coluna Tags', () => {
    const comTags = nota({ tags: ['revisar depois'] });
    expect(dados(exportarDelimitado(pacote([comTags]), ','))[0].endsWith(',cardify::fisiologia revisar_depois')).toBe(
      true,
    );
  });
});

describe('exportarDelimitado: escape', () => {
  it('CSV: campo com vírgula vai entre aspas', () => {
    expect(dados(exportarDelimitado(pacote([nota({ frente: 'a, b' })]), ','))[0]).toBe(
      'Cardify Básico,Fisiologia,"a, b",Verso,cardify::fisiologia',
    );
  });

  it('CSV: aspas internas são dobradas e o campo vai entre aspas', () => {
    expect(dados(exportarDelimitado(pacote([nota({ verso: 'ele disse "oi"' })]), ','))[0]).toBe(
      'Cardify Básico,Fisiologia,Frente,"ele disse ""oi""",cardify::fisiologia',
    );
  });

  it('CSV: tab dentro do campo não exige aspas', () => {
    expect(dados(exportarDelimitado(pacote([nota({ frente: 'a\tb' })]), ','))[0]).toBe(
      'Cardify Básico,Fisiologia,a\tb,Verso,cardify::fisiologia',
    );
  });

  it('TSV: tab dentro do campo vai entre aspas, vírgula não', () => {
    const linha = dados(exportarDelimitado(pacote([nota({ frente: 'a\tb', verso: 'x, y' })]), '\t'))[0];
    expect(linha).toBe('Cardify Básico\tFisiologia\t"a\tb"\tx, y\tcardify::fisiologia');
  });

  it('quebra de linha vira <br> e não exige aspas', () => {
    expect(dados(exportarDelimitado(pacote([nota({ verso: 'linha1\nlinha2\r\nlinha3' })]), ','))[0]).toBe(
      'Cardify Básico,Fisiologia,Frente,linha1<br>linha2<br>linha3,cardify::fisiologia',
    );
  });

  it('<, > e & viram entidades HTML', () => {
    expect(dados(exportarDelimitado(pacote([nota({ frente: 'a < b & c > d' })]), ','))[0]).toBe(
      'Cardify Básico,Fisiologia,a &lt; b &amp; c &gt; d,Verso,cardify::fisiologia',
    );
  });

  it('texto que já parece entidade é escapado de novo, sem perda', () => {
    expect(dados(exportarDelimitado(pacote([nota({ frente: '&lt;' })]), ','))[0].split(',')[2]).toBe('&amp;lt;');
  });

  it('espaço no início ou no fim do campo exige aspas', () => {
    expect(dados(exportarDelimitado(pacote([nota({ frente: ' x ' })]), ','))[0]).toBe(
      'Cardify Básico,Fisiologia," x ",Verso,cardify::fisiologia',
    );
  });

  it('vírgula no nome de trilha vai entre aspas na coluna Deck', () => {
    const nota1 = nota({ trilhaTitulos: ['Cardio, parte 1'] });
    expect(dados(exportarDelimitado(pacote([nota1]), ','))[0].startsWith('Cardify Básico,"Fisiologia::Cardio, parte 1",')).toBe(
      true,
    );
  });
});

describe('exportarDelimitado: ida e volta', () => {
  const frenteDificil = 'Diz "oi", então <b>x</b> & y';
  const versoDificil = 'linha 1\nlinha 2 com "aspas"\te tab';

  it.each([
    [',' as const, 'Frente, "difícil"'],
    ['\t' as const, 'Frente\tcom tab'],
  ])('separador %j: o parser recupera os campos originais', (separador, frente) => {
    const notas = [
      nota({ frente, verso: 'simples', trilhaTitulos: ['Cardio'], ordem: 0 }),
      nota({ frente: frenteDificil, verso: versoDificil, trilhaTitulos: ['Cardio', 'Sístole'], ordem: 1 }),
    ];
    const saida = exportarDelimitado(pacote(notas), separador);
    const corpo = saida
      .split('\n')
      .filter((linha) => !linha.startsWith('#'))
      .join('\n');
    const linhas = parseDelimitado(corpo, separador);

    expect(linhas).toHaveLength(2);
    expect(linhas.every((campos) => campos.length === 6)).toBe(true);

    expect(desfazerHtml(linhas[0][2])).toBe(frente);
    expect(linhas[0][3]).toBe('simples');

    expect(linhas[1][2]).toBe('Diz "oi", então &lt;b&gt;x&lt;/b&gt; &amp; y');
    expect(desfazerHtml(linhas[1][2])).toBe(frenteDificil);
    expect(desfazerHtml(linhas[1][3])).toBe(versoDificil);

    expect(linhas[1][1]).toBe('Fisiologia::Cardio::Sístole');
    expect(linhas[1][4]).toBe('cardify::fisiologia cardify::fisiologia::sistole');
  });
});
