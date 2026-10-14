import { MODEL_ID_BASICO, MODEL_ID_CLOZE, NOTE_TYPE_NOME_BASICO, NOTE_TYPE_NOME_CLOZE } from '@cardify/shared';

/**
 * Se qualquer coisa nos note types mudar (campos, templates, css), incrementar `MOD_MODELOS`: o Anki só
 * atualiza um note type já existente quando o `mod` do pacote é maior que o da coleção. Fixo para que
 * reexportar sem mudança não pareça alteração de schema.
 */
export const MOD_MODELOS = 1_760_000_000;

// Congelado a partir dos note types "Basic" e "Cloze" de fábrica da semente (Anki 25.2). Os `id` de 64 bits
// dos campos e templates não são carregados: JSON.parse os corromperia e o genanki também não os envia.
const CSS_BASE = '.card {\n    font-family: arial;\n    font-size: 20px;\n    text-align: center;\n    color: black;\n    background-color: white;\n}\n';
const CSS_CLOZE = `${CSS_BASE}.cloze {\n    font-weight: bold;\n    color: blue;\n}\n.nightMode .cloze {\n    color: lightblue;\n}\n`;
const LATEX_PRE =
  '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n';
const LATEX_POST = '\\end{document}';

function campo(nome: string, ord: number) {
  return {
    name: nome,
    ord,
    sticky: false,
    rtl: false,
    font: 'Arial',
    size: 20,
    description: '',
    plainText: false,
    collapsed: false,
    excludeFromSearch: false,
    tag: null,
    preventDeletion: false,
  };
}

function template(nome: string, qfmt: string, afmt: string) {
  return { name: nome, ord: 0, qfmt, afmt, bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 };
}

function modelo(id: number, nome: string, tipo: 0 | 1, campos: string[], tmpl: ReturnType<typeof template>, css: string) {
  return {
    id,
    name: nome,
    type: tipo,
    mod: MOD_MODELOS,
    usn: -1,
    sortf: 0,
    did: null,
    tmpls: [tmpl],
    flds: campos.map((nomeCampo, ord) => campo(nomeCampo, ord)),
    css,
    latexPre: LATEX_PRE,
    latexPost: LATEX_POST,
    latexsvg: false,
    req: [[0, 'any', [0]]],
    tags: [],
    vers: [],
  };
}

export function modeloBasico() {
  return modelo(
    MODEL_ID_BASICO,
    NOTE_TYPE_NOME_BASICO,
    0,
    ['Frente', 'Verso'],
    template('Cartão 1', '{{Frente}}', '{{FrontSide}}<hr id=answer>{{Verso}}'),
    CSS_BASE,
  );
}

export function modeloCloze() {
  return modelo(
    MODEL_ID_CLOZE,
    NOTE_TYPE_NOME_CLOZE,
    1,
    ['Texto', 'Extra'],
    template('Cloze', '{{cloze:Texto}}', '{{cloze:Texto}}<br>{{Extra}}'),
    CSS_CLOZE,
  );
}

/** Conteúdo da coluna `col.models`: exatamente os dois note types do Cardify, indexados pelo id. */
export function modelosJson(): string {
  return JSON.stringify({
    [MODEL_ID_BASICO]: modeloBasico(),
    [MODEL_ID_CLOZE]: modeloCloze(),
  });
}
