import type { LedgerLlm, RegistroChamadaLlm } from '@cardify/shared';
import { sql } from 'drizzle-orm';
import type { Db } from './client';
import { anonGastoDiario, llmCalls } from './schema';

export interface OpcoesLedgerLlmDb {
  /** Jobs anônimos somam o custo em `anon_gasto_diario` (teto diário global, RFC §4.5). */
  anonimo: boolean;
}

export class LedgerLlmDb implements LedgerLlm {
  constructor(
    private readonly db: Db,
    private readonly opcoes: OpcoesLedgerLlmDb,
  ) {}

  async registrar(r: RegistroChamadaLlm): Promise<void> {
    const linha = {
      jobId: r.jobId,
      estagio: r.estagio,
      modelo: r.modelo,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      custoCentavos: r.custoCentavos,
      latenciaMs: Math.round(r.latenciaMs),
    };
    if (!this.opcoes.anonimo) {
      await this.db.insert(llmCalls).values(linha);
      return;
    }
    const dia = new Date().toISOString().slice(0, 10);
    await this.db.transaction(async (tx) => {
      await tx.insert(llmCalls).values(linha);
      await tx
        .insert(anonGastoDiario)
        .values({ dia, gastoCentavos: r.custoCentavos })
        .onConflictDoUpdate({
          target: anonGastoDiario.dia,
          set: { gastoCentavos: sql`${anonGastoDiario.gastoCentavos} + EXCLUDED.gasto_centavos` },
        });
    });
  }
}
