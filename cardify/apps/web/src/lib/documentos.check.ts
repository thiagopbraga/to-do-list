// Verificação executável das funções puras da T26. Rodar com: npx tsx apps/web/src/lib/documentos.check.ts
import { caminhoRetornoSeguro } from '../components/conta/retorno';
import {
  classificarDocumento,
  formatarData,
  formatarInteiro,
  formatarPreco,
  formatarPrecoDiluido,
  mascararCpfOuCnpj,
  validarCnpj,
  validarCpf,
} from './documentos';

const falhas: string[] = [];
let total = 0;

function conferir(descricao: string, obtido: unknown, esperado: unknown) {
  total++;
  if (obtido !== esperado) falhas.push(`${descricao}: esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(obtido)}`);
}

const espacoFixo = (texto: string) => texto.replace(/\s/g, ' ');

// CPF: 529.982.247-25 e 111.444.777-35 são exemplos válidos amplamente usados.
for (const cpf of ['52998224725', '11144477735']) {
  conferir(`CPF válido ${cpf}`, classificarDocumento(cpf), 'cpf');
}
// Dígito verificador errado, sequência repetida, tamanho errado, letras.
for (const cpf of ['52998224726', '11111111111', '1234567890', '529.982.247-2a', '']) {
  conferir(`CPF inválido "${cpf}"`, validarCpf(cpf.replace(/\D/g, '')), false);
}

// CNPJ: 11.222.333/0001-81 e 11.444.777/0001-61 são exemplos válidos amplamente usados.
for (const cnpj of ['11222333000181', '11444777000161']) {
  conferir(`CNPJ válido ${cnpj}`, classificarDocumento(cnpj), 'cnpj');
}
for (const cnpj of ['11222333000180', '00000000000000', '1122233300018', '11222333000182']) {
  conferir(`CNPJ inválido ${cnpj}`, validarCnpj(cnpj), false);
}
conferir('CNPJ com máscara', classificarDocumento('11.222.333/0001-81'), 'cnpj');
conferir('CPF com máscara', classificarDocumento('529.982.247-25'), 'cpf');
conferir('tamanho intermediário não é documento', classificarDocumento('1234567890123'), null);

// Máscara progressiva.
conferir('máscara CPF completa', mascararCpfOuCnpj('52998224725'), '529.982.247-25');
conferir('máscara CPF parcial', mascararCpfOuCnpj('5299822'), '529.982.2');
conferir('máscara CNPJ completa', mascararCpfOuCnpj('11222333000181'), '11.222.333/0001-81');
conferir('máscara ignora letras e corta em 14', mascararCpfOuCnpj('11a222333000181999'), '11.222.333/0001-81');
conferir('máscara vazia', mascararCpfOuCnpj(''), '');

// Preços e data.
conferir('preço Essencial', espacoFixo(formatarPreco(2490)), 'R$ 24,90');
conferir('preço Anual', espacoFixo(formatarPreco(24900)), 'R$ 249,00');
conferir('preço zero', espacoFixo(formatarPreco(0)), 'R$ 0,00');
conferir('anual diluído em 12 meses', espacoFixo(formatarPrecoDiluido(24900, 12)), 'R$ 20,75');
conferir('cota com separador de milhar', formatarInteiro(10000).replace(/\s/g, ' '), '10.000');
conferir('data no fuso de Brasília', formatarData('2026-10-14T12:00:00Z'), '14/10/2026');
conferir('data virando o dia no fuso', formatarData('2026-10-15T01:30:00Z'), '14/10/2026');
conferir('data ausente', formatarData(null), null);
conferir('data inválida', formatarData('não é data'), null);

// Caminho de retorno: só caminhos internos relativos.
conferir('retorno padrão', caminhoRetornoSeguro(undefined), '/');
conferir('retorno interno', caminhoRetornoSeguro('/planos'), '/planos');
conferir('retorno com query', caminhoRetornoSeguro('/conta?aba=1'), '/conta?aba=1');
conferir('retorno absoluto rejeitado', caminhoRetornoSeguro('https://evil.example'), '/');
conferir('retorno protocolo relativo rejeitado', caminhoRetornoSeguro('//evil.example'), '/');
conferir('retorno com barra invertida rejeitado', caminhoRetornoSeguro('/\\evil.example'), '/');
conferir('retorno com controle rejeitado', caminhoRetornoSeguro('/a\u0009/evil'), '/');
conferir('retorno para /entrar rejeitado', caminhoRetornoSeguro('/entrar?retorno=/planos'), '/');
conferir('retorno sem barra inicial rejeitado', caminhoRetornoSeguro('planos'), '/');
conferir('retorno padrão configurável', caminhoRetornoSeguro('javascript:alert(1)', '/conta'), '/conta');

if (falhas.length > 0) {
  throw new Error(`documentos.check: ${falhas.length} de ${total} casos falharam:\n  - ${falhas.join('\n  - ')}`);
}
console.log(`documentos.check: ${total} casos OK`);
