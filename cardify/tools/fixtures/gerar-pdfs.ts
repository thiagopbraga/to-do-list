/**
 * Gera os PDFs de teste em fixtures/pdf (+ `<nome>.esperado.json`) e fixtures/texto/colado.txt.
 * Uso: npx tsx tools/fixtures/gerar-pdfs.ts
 *
 * O JSON esperado sai dos mesmos dados que desenham o PDF (ver Compositor), nunca é escrito à mão.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { A4, Compositor, normalizar } from './compositor';
import type { ConfigPagina, Fontes, PaginaDesenhada } from './compositor';
import { AULA_MEDICINA, LEI_SECA, SLIDES, TEXTO_COLADO } from './conteudo';
import { CAPITULOS_DENSO } from './conteudo-denso';
import type { TemaClinico } from './conteudo-denso';
import { mulberry32, paginaEscaneadaPng } from './png';

const RAIZ = resolve(__dirname, '..', '..');
const DIR_PDF = join(RAIZ, 'fixtures', 'pdf');
const DIR_TEXTO = join(RAIZ, 'fixtures', 'texto');
const DATA_FIXA = new Date('2026-01-01T00:00:00Z');

interface Esperado {
  paginas: number;
  escaneado: boolean;
  linhas: { pagina: number; texto: string; fonteTamanho: number; negrito: boolean; ruido: boolean }[];
  ruido: string[];
  titulos: { texto: string; nivel: number }[];
}

async function novoDocumento(titulo: string): Promise<{ doc: PDFDocument; fontes: Fontes }> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(titulo);
  doc.setProducer('Cardify fixtures');
  doc.setCreator('Cardify fixtures');
  doc.setCreationDate(DATA_FIXA);
  doc.setModificationDate(DATA_FIXA);
  const fontes = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    negrito: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  return { doc, fontes };
}

function montarEsperado(paginas: PaginaDesenhada[]): Esperado {
  const linhas: Esperado['linhas'] = [];
  const titulos: Esperado['titulos'] = [];
  const ruido: string[] = [];
  paginas.forEach((pagina, i) => {
    for (const l of pagina.linhas) {
      linhas.push({ pagina: i + 1, texto: l.texto, fonteTamanho: l.tamanho, negrito: l.negrito, ruido: l.ruido });
      if (l.nivel !== null) titulos.push({ texto: l.texto, nivel: l.nivel });
      if (l.ruido) {
        const normalizado = normalizar(l.texto);
        if (normalizado && !ruido.includes(normalizado)) ruido.push(normalizado);
      }
    }
  });
  return { paginas: paginas.length, escaneado: false, linhas, ruido, titulos };
}

async function gravar(nome: string, doc: PDFDocument | Uint8Array, esperado: unknown): Promise<void> {
  const bytes = doc instanceof Uint8Array ? doc : await doc.save({ useObjectStreams: false });
  writeFileSync(join(DIR_PDF, `${nome}.pdf`), bytes);
  writeFileSync(join(DIR_PDF, `${nome}.esperado.json`), `${JSON.stringify(esperado, null, 2)}\n`);
  console.log(`${nome}.pdf  ${bytes.length} bytes`);
}

/** Cabeçalho no topo e, no rodapé, numeração e (opcionalmente) marca d'água. */
function aplicarRuido(
  comp: Compositor,
  cfg: ConfigPagina,
  opcoes: { cabecalho: string; rodape: (n: number, total: number) => string; marcaDagua?: string },
): void {
  const total = comp.paginas.length;
  for (let i = 0; i < total; i++) {
    comp.ruido(i, opcoes.cabecalho, { tamanho: 9, y: cfg.altura - 34, alinhamento: 'esq', cinza: 0.3 });
    comp.ruido(i, opcoes.rodape(i + 1, total), { tamanho: 9, y: 46, alinhamento: 'centro', cinza: 0.3 });
    if (opcoes.marcaDagua) comp.ruido(i, opcoes.marcaDagua, { tamanho: 8, y: 30, alinhamento: 'centro', cinza: 0.65 });
  }
}

const CFG_A4: ConfigPagina = { ...A4, margemEsq: 56, margemDir: 56, topo: 90, base: 90 };

const ESTILOS_TITULO = {
  1: { tamanho: 20, entrelinha: 28, antes: 14, depois: 6 },
  2: { tamanho: 16, entrelinha: 24, antes: 16, depois: 4 },
  3: { tamanho: 13, entrelinha: 19, antes: 10, depois: 2 },
} as const;
const ESTILO_CORPO = { tamanho: 11, entrelinha: 15.5, depois: 6 };

async function gerarAulaMedicina(): Promise<void> {
  const { doc, fontes } = await novoDocumento('Fisiologia Cardiovascular: Fundamentos');
  const comp = new Compositor(CFG_A4, fontes, (n) => n % 3 === 0);
  for (const bloco of AULA_MEDICINA) {
    if (bloco.tipo === 'quebra') comp.quebra();
    else if (bloco.tipo === 'p') comp.paragrafo(bloco.texto, ESTILO_CORPO);
    else {
      const nivel = Number(bloco.tipo[1]) as 1 | 2 | 3;
      comp.titulo(nivel, bloco.texto, ESTILOS_TITULO[nivel]);
    }
  }
  aplicarRuido(comp, CFG_A4, {
    cabecalho: 'Faculdade de Medicina — Fisiologia II — Prof. Silva',
    rodape: (n, total) => `Página ${n} de ${total}`,
    marcaDagua: 'Material exclusivo CURSINHO APROVA — uso pessoal',
  });
  const paginas = comp.finalizar();
  if (paginas.length !== 6) throw new Error(`aula-medicina deveria ter 6 páginas, tem ${paginas.length}`);
  comp.desenhar(doc);
  await gravar('aula-medicina', doc, montarEsperado(paginas));
}

async function gerarLeiSeca(): Promise<void> {
  const { doc, fontes } = await novoDocumento('Código Tributário Fictício');
  const cfg: ConfigPagina = { ...A4, margemEsq: 64, margemDir: 64, topo: 90, base: 90 };
  const comp = new Compositor(cfg, fontes);
  const base = { tamanho: 11, entrelinha: 16 };
  for (const item of LEI_SECA) {
    switch (item.nivel) {
      case 'cap':
        comp.espaco(10);
        comp.paragrafo(item.texto, { ...base, depois: 4 });
        break;
      case 'art':
      case 'par':
        comp.paragrafo(item.texto, { ...base, depois: 4 });
        break;
      case 'inc':
        comp.paragrafo(item.texto, { ...base, recuo: 24, depois: 2 });
        break;
      case 'ali':
        comp.paragrafo(item.texto, { ...base, recuo: 48, depois: 2 });
        break;
    }
  }
  aplicarRuido(comp, cfg, {
    cabecalho: 'Código Tributário Fictício — Texto compilado',
    rodape: (n) => `Página ${n}`,
  });
  const paginas = comp.finalizar();
  if (paginas.length !== 4) throw new Error(`lei-seca deveria ter 4 páginas, tem ${paginas.length}`);
  comp.desenhar(doc);
  await gravar('lei-seca', doc, montarEsperado(paginas));
}

async function gerarSlides(): Promise<void> {
  const { doc, fontes } = await novoDocumento('Fisiologia Cardiovascular — Slides');
  const cfg: ConfigPagina = { largura: A4.altura, altura: A4.largura, margemEsq: 60, margemDir: 60, topo: 50, base: 40 };
  const comp = new Compositor(cfg, fontes);
  for (const slide of SLIDES) {
    comp.quebra();
    comp.titulo(1, slide.titulo, { tamanho: 28, entrelinha: 34, antes: 0, depois: 34 });
    for (const bullet of slide.bullets) {
      comp.paragrafo(bullet, { tamanho: 18, entrelinha: 34, marcador: '•' });
    }
  }
  const paginas = comp.finalizar();
  if (paginas.length !== 5) throw new Error(`slides deveria ter 5 páginas, tem ${paginas.length}`);
  comp.desenhar(doc);
  await gravar('slides', doc, montarEsperado(paginas));
}

async function gerarEscaneado(): Promise<void> {
  const { doc } = await novoDocumento('Documento escaneado');
  for (let i = 0; i < 3; i++) {
    const imagem = await doc.embedPng(paginaEscaneadaPng(496, 702, 1000 + i));
    const pagina = doc.addPage([A4.largura, A4.altura]);
    pagina.drawImage(imagem, { x: 0, y: 0, width: A4.largura, height: A4.altura });
  }
  const esperado: Esperado = { paginas: 3, escaneado: true, linhas: [], ruido: [], titulos: [] };
  await gravar('escaneado', doc, esperado);
}

function paragrafosDenso(tema: TemaClinico, secao: number): string[][] {
  const rand = mulberry32(secao * 7919 + 17);
  const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const usadas = new Set<number>();

  const vinheta = (k: number) =>
    `No caso didático ${secao}.${k}, o paciente tinha ${ri(28, 84)} anos, pressão arterial de ${ri(98, 176)}/${ri(58, 104)} mmHg, frequência cardíaca de ${ri(54, 128)} bpm e saturação de oxigênio de ${ri(88, 99)}% em ar ambiente.`;
  const fillers: ((k: number) => string)[] = [
    (k) => `Na série didática do exercício ${secao}.${k}, ${ri(40, 400)} pacientes foram acompanhados por uma mediana de ${ri(3, 36)} meses, com ${ri(2, 60)} reinternações no período.`,
    (k) => `O valor de corte usado na questão ${secao}.${k} foi de ${ri(10, 90)} unidades, e o intervalo de referência do laboratório foi de ${ri(1, 9)} a ${ri(10, 30)} unidades.`,
    () => `Ao final da seção ${secao}, o aluno deve ser capaz de listar ${ri(3, 9)} critérios diagnósticos e justificar a escolha do tratamento em ${ri(2, 12)} minutos.`,
    (k) => `A prevalência fictícia adotada no exemplo ${secao}.${k} é de ${ri(1, 29)},${ri(0, 9)}% da população estudada, apenas para o cálculo de valores preditivos.`,
    (k) => `No exemplo de cálculo ${secao}.${k}, com sensibilidade de ${ri(70, 99)}% e especificidade de ${ri(60, 99)}%, um teste aplicado a ${ri(100, 5000)} pacientes gera falsos positivos e falsos negativos que podem mudar a conduta.`,
    () => `No capítulo sobre ${tema.titulo} (seção ${secao}), o seguimento ambulatorial inclui ${ri(2, 8)} consultas no primeiro ano e ${ri(2, 12)} exames laboratoriais de controle.`,
    () => `A revisão da lista de medicamentos a cada consulta e a educação do paciente sobre sinais de alarme reduzem atrasos no atendimento e eventos adversos evitáveis.`,
    () => `Recomenda-se reavaliação clínica em ${ri(7, 90)} dias, com registro de peso, sinais vitais e adesão ao tratamento, e retorno imediato diante de sinais de alarme.`,
  ];
  const completar = (inicio: string, k: number, alvo: number) => {
    let texto = inicio;
    while (texto.length < alvo) {
      let i = ri(0, fillers.length - 1);
      while (usadas.has(i)) i = (i + 1) % fillers.length;
      usadas.add(i);
      texto += ` ${fillers[i](k)}`;
      if (usadas.size === fillers.length) usadas.clear();
    }
    return texto;
  };

  usadas.add(2);
  usadas.add(4);
  return [
    [completar(`${tema.definicao}. ${vinheta(1)}`, 1, 0), completar(fillers[2](1), 2, 200)],
    [completar(`Os achados mais frequentes incluem ${tema.achados}. ${vinheta(2)}`, 3, 0), completar(fillers[4](3), 4, 200)],
    [completar(`A conduta inicial consiste em ${tema.conduta}.`, 5, 330), completar(vinheta(3), 6, 200)],
  ];
}

async function gerarDenso(): Promise<void> {
  const { doc, fontes } = await novoDocumento('Atlas de Clínica Médica');
  const comp = new Compositor(CFG_A4, fontes, (n) => n % 5 === 0);
  let secao = 0;
  CAPITULOS_DENSO.forEach((capitulo, ci) => {
    capitulo.temas.forEach((tema, ti) => {
      secao++;
      comp.quebra();
      if (ti === 0) comp.titulo(1, `Capítulo ${ci + 1}: ${capitulo.titulo}`, ESTILOS_TITULO[1]);
      comp.titulo(2, `${ci + 1}.${ti + 1} ${tema.titulo}`, ESTILOS_TITULO[2]);
      const rotulos = ['Definição e contexto', 'Achados e diagnóstico', 'Conduta e seguimento'];
      paragrafosDenso(tema, secao).forEach((paragrafos, si) => {
        comp.titulo(3, `${ci + 1}.${ti + 1}.${si + 1} ${rotulos[si]}`, ESTILOS_TITULO[3]);
        for (const p of paragrafos) comp.paragrafo(p, ESTILO_CORPO);
      });
    });
  });
  aplicarRuido(comp, CFG_A4, {
    cabecalho: 'Atlas de Clínica Médica — Material de estudo',
    rodape: (n, total) => `Página ${n} de ${total}`,
    marcaDagua: 'Cópia licenciada para uso individual — proibida a redistribuição',
  });
  const paginas = comp.finalizar();
  if (paginas.length !== 40) throw new Error(`denso deveria ter 40 páginas, tem ${paginas.length}`);
  comp.desenhar(doc);
  await gravar('denso-40-paginas', doc, montarEsperado(paginas));
}

async function gerarCorrompido(): Promise<void> {
  const truncado = [
    '%PDF-1.7',
    '%\xe2\xe3\xcf\xd3',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>',
    'endobj',
    '5 0 obj',
    '<< /Length 4096 /Filter /FlateDecode >>',
    'stream',
    'x\x9c\xed\xbd\x4b\x93\xdb\xc8\x91\x2e\xf8\x7e\xbf\x42\x0c\xb4',
  ].join('\n');
  await gravar('corrompido', Buffer.from(truncado, 'latin1'), { corrompido: true });
}

async function main(): Promise<void> {
  mkdirSync(DIR_PDF, { recursive: true });
  mkdirSync(DIR_TEXTO, { recursive: true });
  await gerarAulaMedicina();
  await gerarLeiSeca();
  await gerarSlides();
  await gerarEscaneado();
  await gerarDenso();
  await gerarCorrompido();
  writeFileSync(join(DIR_TEXTO, 'colado.txt'), TEXTO_COLADO);
  console.log(`colado.txt  ${TEXTO_COLADO.length} caracteres`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
