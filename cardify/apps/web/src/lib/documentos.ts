export type TipoDocumento = 'cpf' | 'cnpj';

const PESOS_CPF_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CPF_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

function dvCpf(base: string, pesos: number[]): number {
  const soma = pesos.reduce((total, peso, i) => total + Number(base[i]) * peso, 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function dvCnpj(base: string, pesos: number[]): number {
  const soma = pesos.reduce((total, peso, i) => total + Number(base[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCpf(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const dv1 = dvCpf(digitos.slice(0, 9), PESOS_CPF_1);
  const dv2 = dvCpf(digitos.slice(0, 9) + dv1, PESOS_CPF_2);
  return digitos.slice(9) === `${dv1}${dv2}`;
}

export function validarCnpj(digitos: string): boolean {
  if (!/^\d{14}$/.test(digitos) || /^(\d)\1{13}$/.test(digitos)) return false;
  const dv1 = dvCnpj(digitos.slice(0, 12), PESOS_CNPJ_1);
  const dv2 = dvCnpj(digitos.slice(0, 12) + dv1, PESOS_CNPJ_2);
  return digitos.slice(12) === `${dv1}${dv2}`;
}

/** Recebe texto com ou sem máscara e devolve o tipo do documento, ou null se for inválido. */
export function classificarDocumento(texto: string): TipoDocumento | null {
  const digitos = somenteDigitos(texto);
  if (validarCpf(digitos)) return 'cpf';
  if (validarCnpj(digitos)) return 'cnpj';
  return null;
}

/** Máscara progressiva: até 11 dígitos formata como CPF; a partir do 12º dígito, como CNPJ. */
export function mascararCpfOuCnpj(texto: string): string {
  const digitos = somenteDigitos(texto).slice(0, 14);
  if (digitos.length <= 11) {
    return digitos.replace(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/, (_, a: string, b: string, c: string, d: string) =>
      [a, b && `.${b}`, c && `.${c}`, d && `-${d}`].join(''),
    );
  }
  return digitos.replace(
    /^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})/,
    (_, a: string, b: string, c: string, d: string, e: string) =>
      [a, b && `.${b}`, c && `.${c}`, d && `/${d}`, e && `-${e}`].join(''),
  );
}

const formatadorBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatadorInteiro = new Intl.NumberFormat('pt-BR');
const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Preço em centavos para reais, ex.: 2490 → "R$ 24,90". */
export function formatarPreco(centavos: number): string {
  return formatadorBrl.format(centavos / 100);
}

/** Valor de um plano anual diluído em meses, ex.: (24900, 12) → "R$ 20,75". */
export function formatarPrecoDiluido(centavos: number, meses: number): string {
  return formatarPreco(Math.round(centavos / meses));
}

export function formatarInteiro(valor: number): string {
  return formatadorInteiro.format(valor);
}

/** Data ISO para dd/mm/aaaa no fuso de Brasília; null quando ausente ou inválida. */
export function formatarData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return formatadorData.format(data);
}
