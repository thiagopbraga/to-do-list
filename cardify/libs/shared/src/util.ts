/** Remove acentos via NFD. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Slug ASCII em minúsculas, separado por hífen. Usado em tags e nomes de arquivo. */
export function slugify(texto: string, maxLen = 60): string {
  const slug = semAcento(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
  return slug || 'sem-titulo';
}

/** Chaves de object storage. O dono é `u-<userId>` ou `a-<anonSessionId>`. */
export const chaveStorage = {
  documento: (dono: string, documentId: string) => `docs/${dono}/${documentId}/original`,
  textoExtraido: (dono: string, documentId: string) => `docs/${dono}/${documentId}/texto.json`,
  exportacao: (dono: string, exportId: string, extensao: string) => `exports/${dono}/${exportId}.${extensao}`,
};

export function donoStorage(ref: { userId?: string | null; anonSessionId?: string | null }): string {
  if (ref.userId) return `u-${ref.userId}`;
  if (ref.anonSessionId) return `a-${ref.anonSessionId}`;
  throw new Error('documento sem dono');
}
