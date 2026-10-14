import { MAX_NIVEIS_SUBDECK, PREFIXO_TAG, slugify } from '@cardify/shared';

/**
 * Tags de uma nota: `cardify::<doc>`, `cardify::<doc>::<última seção>` e as tags extras do usuário.
 * Tags do Anki não aceitam espaço, então espaços viram `_`.
 */
export function tagsDaNota(slugDocumento: string, trilhaTitulos: string[], tagsExtras: string[]): string[] {
  const raiz = `${PREFIXO_TAG}::${slugDocumento}`;
  const tags = [raiz];
  if (trilhaTitulos.length > 0) {
    tags.push(`${raiz}::${slugify(trilhaTitulos[trilhaTitulos.length - 1])}`);
  }
  for (const extra of tagsExtras) {
    const tag = extra.trim().replace(/\s+/g, '_');
    if (tag) tags.push(tag);
  }
  return semDuplicatas(tags);
}

/**
 * Nome do deck da nota: baralho raiz seguido de até MAX_NIVEIS_SUBDECK níveis da trilha.
 * `::` é o separador de subdeck no Anki, então não pode aparecer dentro de uma parte.
 */
export function nomeDeckDaNota(nomeBaralho: string, trilhaTitulos: string[]): string {
  const raiz = sanitizarParteDeck(nomeBaralho) || 'Baralho';
  const niveis = trilhaTitulos
    .map(sanitizarParteDeck)
    .filter((parte) => parte !== '')
    .slice(0, MAX_NIVEIS_SUBDECK);
  return [raiz, ...niveis].join('::');
}

function sanitizarParteDeck(texto: string): string {
  return texto
    .replace(/"/g, '')
    .replace(/:{2,}/g, ':')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:]+|[\s:]+$/g, '');
}

/** Tags do Anki são case-insensitive: `Revisar` e `revisar` seriam a mesma tag na importação. */
function semDuplicatas(tags: string[]): string[] {
  const vistas = new Set<string>();
  return tags.filter((tag) => {
    const chave = tag.toLowerCase();
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}
