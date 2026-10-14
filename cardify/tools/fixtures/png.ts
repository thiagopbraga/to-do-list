import { crc32, deflateSync } from 'node:zlib';

export function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const cabecalho = Buffer.alloc(8);
  cabecalho.writeUInt32BE(dados.length, 0);
  cabecalho.write(tipo, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([cabecalho.subarray(4), dados])), 0);
  return Buffer.concat([cabecalho, dados, crc]);
}

/** PNG em tons de cinza, 8 bits, sem entrelaçamento. */
export function criarPngCinza(largura: number, altura: number, pixel: (x: number, y: number) => number): Buffer {
  const bruto = Buffer.alloc((largura + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const base = y * (largura + 1);
    bruto[base] = 0;
    for (let x = 0; x < largura; x++) bruto[base + 1 + x] = pixel(x, y);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(bruto, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/** Imagem de "página escaneada": papel levemente ruidoso com barras escuras no lugar das linhas de texto. */
export function paginaEscaneadaPng(largura: number, altura: number, semente: number): Buffer {
  const rand = mulberry32(semente);
  const escuro = new Uint8Array(largura * altura);
  const margem = 44;
  let y = 70;
  let linhasNoParagrafo = 0;
  while (y < altura - 70) {
    let x = margem;
    const fim = linhasNoParagrafo >= 6 + Math.floor(rand() * 3) ? margem + Math.floor(rand() * 200) : largura - margem;
    while (x < fim) {
      const larguraPalavra = Math.min(18 + Math.floor(rand() * 54), fim - x);
      for (let dy = 0; dy < 9; dy++) {
        for (let dx = 0; dx < larguraPalavra; dx++) escuro[(y + dy) * largura + x + dx] = 1;
      }
      x += larguraPalavra + 7 + Math.floor(rand() * 5);
    }
    if (fim < largura - margem) {
      linhasNoParagrafo = 0;
      y += 20;
    } else {
      linhasNoParagrafo++;
    }
    y += 22;
  }
  return criarPngCinza(largura, altura, (px, py) => {
    const ruido = Math.floor(rand() * 7) - 3;
    return escuro[py * largura + px] ? 55 + ruido : 236 + ruido;
  });
}
