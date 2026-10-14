/**
 * Aceita só caminhos internos relativos (ex.: `/planos`). Qualquer outro valor cai em `padrao`,
 * inclusive `//host` e `/\host`, que os navegadores tratam como URL externa.
 */
export function caminhoRetornoSeguro(valor: string | undefined, padrao = '/'): string {
  if (!valor || !valor.startsWith('/')) return padrao;
  if (valor.startsWith('//') || valor.startsWith('/\\')) return padrao;
  if ([...valor].some((caractere) => caractere.charCodeAt(0) < 0x20 || caractere.charCodeAt(0) === 0x7f || caractere === '\\')) return padrao;
  if (/^\/entrar([/?#]|$)/.test(valor)) return padrao;
  return valor;
}

export function primeiroValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
