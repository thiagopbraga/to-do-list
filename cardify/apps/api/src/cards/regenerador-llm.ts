import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { chunks, eq, jobs, LedgerLlmDb, sql, type CardRow, type Db } from '@cardify/db';
import { criarLlmProvider, LlmClienteRegistrado, modeloPorTier, OrcamentoJob, regenerarCard } from '@cardify/generation';
import { CardifyError, type ChunkDocumento, type Env, type LlmProvider } from '@cardify/shared';
import { DB, ENV } from '../infra/tokens';
import type { ConteudoRegenerado, RegeneradorCards } from './regenerador';

/** Teto de custo de uma regeneração, em centavos: um card custa uma fração disso. */
export const TETO_REGENERACAO_CENTAVOS = 5;

/** Regenera um card pelo LLM com o trecho de origem como contexto; custo vai para o ledger e para o job. */
@Injectable()
export class RegeneradorLlm implements RegeneradorCards {
  private provider: LlmProvider | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async regenerar(card: CardRow): Promise<ConteudoRegenerado> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, card.jobId));
    // Regenerar gasta LLM fora dos limites da amostra anônima: exige conta.
    if (!job || !job.userId) throw new ForbiddenException({ erro: 'login_necessario', mensagem: 'Entre para regenerar cards.' });

    const cliente = new LlmClienteRegistrado(this.obterProvider(), new LedgerLlmDb(this.db, { anonimo: false }), {
      usdBrl: this.env.USD_BRL,
      modeloPorTier: modeloPorTier(this.env),
    });
    const orcamento = new OrcamentoJob(TETO_REGENERACAO_CENTAVOS);
    try {
      const novo = await regenerarCard(
        cliente,
        { jobId: job.id, orcamento },
        {
          tipo: card.tipo,
          frente: card.frente,
          verso: card.verso,
          textoCloze: card.textoCloze,
          tagSecao: card.trilhaTitulos.at(-1) ?? '',
          fonteOffset: card.fonteOffset,
        },
        await this.chunkDoCard(card),
        job.params,
      );
      return { tipo: novo.tipo, frente: novo.frente, verso: novo.verso, textoCloze: novo.textoCloze };
    } catch (erro) {
      if (erro instanceof CardifyError) {
        throw new ServiceUnavailableException({ erro: 'regeneracao_falhou', mensagem: 'Não foi possível regenerar este card agora.' });
      }
      throw erro;
    } finally {
      if (orcamento.gastoCentavos > 0) {
        await this.db
          .update(jobs)
          .set({ custoCentavos: sql`${jobs.custoCentavos} + ${orcamento.gastoCentavos}` })
          .where(eq(jobs.id, job.id));
      }
    }
  }

  private async chunkDoCard(card: CardRow): Promise<ChunkDocumento> {
    if (card.chunkId) {
      const [chunk] = await this.db.select().from(chunks).where(eq(chunks.id, card.chunkId));
      if (chunk) return { ordem: chunk.ordem, trilhaTitulos: chunk.trilhaTitulos, texto: chunk.texto, tokens: chunk.tokens };
    }
    return { ordem: 0, trilhaTitulos: card.trilhaTitulos, texto: `${card.frente}\n\n${card.verso}`, tokens: 0 };
  }

  private obterProvider(): LlmProvider {
    this.provider ??= criarLlmProvider(this.env);
    return this.provider;
  }
}
