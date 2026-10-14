import yauzl from 'yauzl';

/** Lê um zip inteiro em memória: caminho da entrada -> conteúdo. Diretórios são ignorados. */
export function lerZip(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (erroAbrir, zip) => {
      if (erroAbrir) return reject(erroAbrir);
      const arquivos = new Map<string, Buffer>();
      zip.on('error', reject);
      zip.on('end', () => resolve(arquivos));
      zip.on('entry', (entrada: yauzl.Entry) => {
        if (entrada.fileName.endsWith('/')) return zip.readEntry();
        zip.openReadStream(entrada, (erroLer, stream) => {
          if (erroLer) return reject(erroLer);
          const partes: Buffer[] = [];
          stream.on('data', (parte: Buffer) => partes.push(parte));
          stream.on('error', reject);
          stream.on('end', () => {
            arquivos.set(entrada.fileName, Buffer.concat(partes));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}
