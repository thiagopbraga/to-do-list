import { ConflictException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { type CardRow, type Db, and, asc, cards, eq, inArray, jobs, sql } from '@cardify/db';
import type { CardRevisao, EditarCard } from '@cardify/shared';
import { DB } from '../infra/tokens';
import { mesmoDono, type Dono } from '../sessao/dono';
import { type Tx, cardDoDono, jobDoDono, naoEncontrado } from './acesso';
import { fecharConteudo } from './conteudo';
import { paraCardRevisao } from './mapeamento';
import { REGENERADOR, type RegeneradorCards } from './regenerador';
import type { ListarCards, LoteCards, OrdemCards } from './schemas';

function unicas(valores: string[]): string[] {
  return [...new Set(valores)];
}

function mesmosItens(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((valor, indice) => valor === b[indice]);
}

@Injectable()
export class RevisaoService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REGENERADOR) private readonly regenerador: RegeneradorCards,
  ) {}

  async listar(jobId: string, dono: Dono, consulta: ListarCards) {
    await jobDoDono(this.db, jobId, dono);
    const doJob = eq(cards.jobId, jobId);
    const onde = consulta.incluirDescartados ? doJob : and(doJob, sql`${cards.estado} <> 'descartado'`);
    const [{ total }] = await this.db.select({ total: sql<number>`count(*)::int` }).from(cards).where(onde);
    const linhas = await this.db
      .select()
      .from(cards)
      .where(onde)
      .orderBy(asc(cards.ordem), asc(cards.id))
      .limit(consulta.tamanho)
      .offset((consulta.pagina - 1) * consulta.tamanho);
    return {
      cards: linhas.map(paraCardRevisao),
      total,
      pagina: consulta.pagina,
      tamanho: consulta.tamanho,
    };
  }

  async editar(cardId: string, dados: EditarCard, dono: Dono): Promise<CardRevisao> {
    const { card } = await cardDoDono(this.db, cardId, dono);
    if (Object.keys(dados).every((campo) => campo === 'ordem')) {
      // Ordem não é conteúdo do card: não marca edição nem avança updatedAt (que vira o `mod` da nota no Anki).
      const [reordenado] = await this.db.update(cards).set({ ordem: dados.ordem }).where(eq(cards.id, cardId)).returning();
      return paraCardRevisao(reordenado);
    }
    const conteudo = fecharConteudo({
      tipo: dados.tipo ?? card.tipo,
      frente: dados.frente,
      frenteAtual: card.frente,
      verso: dados.verso ?? card.verso,
      textoCloze: dados.textoCloze !== undefined ? dados.textoCloze : card.textoCloze,
    });
    const [atualizado] = await this.db
      .update(cards)
      .set({
        ...conteudo,
        ...(dados.tags !== undefined ? { tags: unicas(dados.tags) } : {}),
        ...(dados.ordem !== undefined ? { ordem: dados.ordem } : {}),
        estado: 'editado',
        updatedAt: sql`now()`,
      })
      .where(eq(cards.id, cardId))
      .returning();
    return paraCardRevisao(atualizado);
  }

  async descartar(cardId: string, dono: Dono): Promise<void> {
    await cardDoDono(this.db, cardId, dono);
    await this.db
      .update(cards)
      .set({ estado: 'descartado' })
      .where(and(eq(cards.id, cardId), sql`${cards.estado} <> 'descartado'`));
  }

  async lote(corpo: LoteCards, dono: Dono): Promise<{ alterados: number }> {
    const ids = unicas(corpo.ids);
    return this.db.transaction(async (tx) => {
      const linhas = await tx
        .select({ card: cards, job: jobs })
        .from(cards)
        .innerJoin(jobs, eq(jobs.id, cards.jobId))
        .where(inArray(cards.id, ids))
        .for('update', { of: cards });
      if (linhas.length !== ids.length || linhas.some(({ job }) => !mesmoDono(dono, job))) {
        throw naoEncontrado();
      }
      const alterados = await this.aplicarAcaoLote(
        tx,
        corpo,
        linhas.map(({ card }) => card),
      );
      return { alterados };
    });
  }

  private async aplicarAcaoLote(tx: Tx, corpo: LoteCards, alvos: CardRow[]): Promise<number> {
    switch (corpo.acao) {
      case 'descartar': {
        const ids = alvos.filter((card) => card.estado !== 'descartado').map((card) => card.id);
        if (ids.length > 0) await tx.update(cards).set({ estado: 'descartado' }).where(inArray(cards.id, ids));
        return ids.length;
      }
      case 'restaurar': {
        const ids = alvos.filter((card) => card.estado === 'descartado').map((card) => card.id);
        if (ids.length > 0) {
          await tx
            .update(cards)
            .set({
              estado: sql`(CASE WHEN ${cards.updatedAt} > ${cards.createdAt} THEN 'editado' ELSE 'gerado' END)::card_estado`,
            })
            .where(inArray(cards.id, ids));
        }
        return ids.length;
      }
      case 'adicionarTags':
      case 'removerTags': {
        const tags = unicas(corpo.tags ?? []);
        let alterados = 0;
        for (const card of alvos) {
          const novas =
            corpo.acao === 'adicionarTags'
              ? unicas([...card.tags, ...tags])
              : card.tags.filter((tag) => !tags.includes(tag));
          if (mesmosItens(novas, card.tags)) continue;
          await tx.update(cards).set({ tags: novas, updatedAt: sql`now()` }).where(eq(cards.id, card.id));
          alterados++;
        }
        return alterados;
      }
    }
  }

  async ordenar(jobId: string, corpo: OrdemCards, dono: Dono): Promise<void> {
    await jobDoDono(this.db, jobId, dono);
    await this.db.transaction(async (tx) => {
      const atuais = await tx
        .select({ id: cards.id, ordem: cards.ordem })
        .from(cards)
        .where(eq(cards.jobId, jobId))
        .orderBy(asc(cards.ordem), asc(cards.id))
        .for('update');
      const existentes = new Set(atuais.map((card) => card.id));
      const pedidos = new Set(corpo.ids);
      if (pedidos.size !== corpo.ids.length || corpo.ids.some((id) => !existentes.has(id))) {
        throw new UnprocessableEntityException({ erro: 'ids_invalidos' });
      }

      const finais = [...corpo.ids, ...atuais.filter((card) => !pedidos.has(card.id)).map((card) => card.id)];
      const ordemAtual = new Map(atuais.map((card) => [card.id, card.ordem]));
      const mudancas = finais
        .map((id, posicao) => ({ id, posicao }))
        .filter(({ id, posicao }) => ordemAtual.get(id) !== posicao);
      if (mudancas.length === 0) return;

      await tx.execute(sql`
        UPDATE cards AS c
        SET ordem = v.ordem
        FROM (VALUES ${sql.join(
          mudancas.map(({ id, posicao }) => sql`(${id}::uuid, ${posicao}::integer)`),
          sql`, `,
        )}) AS v(id, ordem)
        WHERE c.id = v.id
      `);
    });
  }

  /** Cria um card novo com o conteúdo regenerado e descarta o antigo (RFC §5.4: nota nova no Anki). */
  async regenerar(cardId: string, dono: Dono): Promise<CardRevisao> {
    const { card } = await cardDoDono(this.db, cardId, dono);
    const gerado = await this.regenerador.regenerar(card);
    const conteudo = fecharConteudo({
      tipo: gerado.tipo,
      frente: gerado.frente,
      frenteAtual: card.frente,
      verso: gerado.verso,
      textoCloze: gerado.textoCloze,
    });

    const criado = await this.db.transaction(async (tx) => {
      const [atual] = await tx.select({ estado: cards.estado }).from(cards).where(eq(cards.id, cardId)).for('update');
      if (!atual || atual.estado === 'descartado') throw new ConflictException({ erro: 'card_descartado' });

      const [novo] = await tx
        .insert(cards)
        .values({
          jobId: card.jobId,
          chunkId: card.chunkId,
          ...conteudo,
          tags: card.tags,
          trilhaTitulos: card.trilhaTitulos,
          fonteOffset: card.fonteOffset,
          estado: 'gerado',
          ordem: card.ordem,
          substituiCardId: card.id,
        })
        .returning();
      await tx.update(cards).set({ estado: 'descartado' }).where(eq(cards.id, cardId));
      return novo;
    });
    return paraCardRevisao(criado);
  }
}
