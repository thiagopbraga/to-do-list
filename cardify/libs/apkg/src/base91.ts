// Mesmo alfabeto e mesma conversão do `base91()` do Anki (pylib/anki/utils.py) e do `guid_for()` do
// genanki: letras minúsculas, maiúsculas, dígitos e 29 símbolos, dividindo repetidamente por 91 o
// inteiro de 64 bits SEM SINAL (hash[0..8] lido big-endian). 91^10 > 2^64, então o GUID tem <= 10 caracteres.
export const ALFABETO_BASE91 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';

export function base91(numero: bigint): string {
  if (numero < 0n) throw new RangeError('base91 exige inteiro sem sinal');
  if (numero === 0n) return ALFABETO_BASE91[0];
  let resto = numero;
  let saida = '';
  while (resto > 0n) {
    saida = ALFABETO_BASE91[Number(resto % 91n)] + saida;
    resto /= 91n;
  }
  return saida;
}
