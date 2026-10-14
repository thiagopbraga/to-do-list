import { naoImplementado, type ApkgPacker, type PacoteBaralho } from '@cardify/shared';

/** T11 — GUID estável derivado do UUID do card: base91(sha1(id)[0..8]) (RFC §5.4). */
export function guidDoCard(_cardId: string): string {
  naoImplementado('T11');
}

/** T11 — csum do Anki: parseInt(sha1(campoTextoPuro).slice(0, 8), 16). */
export function csumCampo(_texto: string): number {
  naoImplementado('T11');
}

/** T11 — empacotador .apkg sobre a semente versionada (RFC §5). */
export class AnkiApkgPacker implements ApkgPacker {
  constructor(readonly caminhoSeed?: string) {}
  async empacotar(_pacote: PacoteBaralho): Promise<Buffer> {
    naoImplementado('T11');
  }
}
