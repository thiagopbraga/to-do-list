import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Db, documents, eq, exportacoes, jobs, magicLinks, users } from '@cardify/db';
import type { StorageService } from '@cardify/shared';
import { DB, STORAGE } from '../infra/tokens';

@Injectable()
export class ContaService {
  private readonly logger = new Logger(ContaService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: StorageService,
  ) {}

  /** Exclusão imediata (RFC §11): objetos do storage primeiro, depois o usuário; as FKs fazem a cascata. */
  async excluir(userId: string): Promise<void> {
    const [usuario] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (!usuario) return;

    const docs = await this.db
      .select({ storageKey: documents.storageKey, textoExtraidoKey: documents.textoExtraidoKey })
      .from(documents)
      .where(eq(documents.userId, userId));
    const exps = await this.db
      .select({ storageKey: exportacoes.storageKey })
      .from(exportacoes)
      .innerJoin(jobs, eq(jobs.id, exportacoes.jobId))
      .where(eq(jobs.userId, userId));

    const chaves = new Set<string>();
    for (const d of docs) {
      chaves.add(d.storageKey);
      if (d.textoExtraidoKey) chaves.add(d.textoExtraidoKey);
    }
    for (const e of exps) if (e.storageKey) chaves.add(e.storageKey);

    // Falha de storage não bloqueia a exclusão da conta; as regras de ciclo de vida do bucket removem o resto.
    const resultados = await Promise.allSettled([...chaves].map((chave) => this.storage.apagar(chave)));
    const falhas = resultados.filter((r) => r.status === 'rejected').length;
    if (falhas > 0) this.logger.warn(`exclusão de conta: ${falhas} de ${chaves.size} objetos não foram apagados do storage`);

    await this.db.transaction(async (tx) => {
      await tx.delete(magicLinks).where(eq(magicLinks.email, usuario.email));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }
}
