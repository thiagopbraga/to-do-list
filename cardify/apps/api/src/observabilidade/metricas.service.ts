import { Inject, Injectable } from '@nestjs/common';
import { type Db, sql } from '@cardify/db';
import { DB } from '../infra/tokens';

export const TETO_DESCARTE_PRD = 0.25;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface Percentis {
  amostras: number;
  p50: number | null;
  p95: number | null;
}

export interface Metricas {
  janelaDias: number;
  geradoEm: string;
  /** Jobs concluídos/parciais, não amostra. Valores em centavos de real. */
  custoPorBaralhoCentavos: Percentis;
  /** Cards descartados / cards totais, só de jobs com ao menos 1 export. */
  taxaDescarte: { taxa: number | null; descartados: number; total: number; jobs: number; teto: number };
  /** Jobs de amostra concluídos: `finished_at - created_at`, em segundos. */
  tempoAtePrimeiroCardSegundos: Percentis;
  /** Jobs finalizados (concluido, parcial, falhou) por tipo de documento. */
  falhasPorTipoDocumento: Array<{ tipo: string; falhas: number; total: number; taxa: number | null }>;
  topErros: Array<{ tipo: string; mensagem: string; ocorrencias: number }>;
  taxaFalhaJobs: number | null;
  /** `reparo` / `formulacao`. O estágio que pediu o reparo não é gravado, então reparos de extração entram no numerador. */
  taxaReparoJson: number | null;
  /** `reformulacao_cloze` / `formulacao`. */
  taxaReprovacaoCloze: number | null;
  estagios: Array<{
    estagio: string;
    chamadas: number;
    tokensIn: number;
    tokensOut: number;
    custoCentavos: number;
    latenciaMediaMs: number | null;
  }>;
}

type Linha = Record<string, unknown>;

const numero = (valor: unknown): number | null => (valor === null || valor === undefined ? null : Number(valor));

function razao(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

@Injectable()
export class MetricasService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async gerar(dias: number, agora: Date = new Date()): Promise<Metricas> {
    const desde = new Date(agora.getTime() - dias * DIA_MS);
    const [custo, descarte, tempo, porTipo, erros, reparo, estagios] = await Promise.all([
      this.custoPorBaralho(desde),
      this.descarte(desde),
      this.tempoAtePrimeiroCard(desde),
      this.falhasPorTipo(desde),
      this.topErros(desde),
      this.chamadasLlm(desde),
      this.porEstagio(desde),
    ]);

    const finalizados = porTipo.reduce((soma, t) => soma + t.total, 0);
    const falhas = porTipo.reduce((soma, t) => soma + t.falhas, 0);

    return {
      janelaDias: dias,
      geradoEm: agora.toISOString(),
      custoPorBaralhoCentavos: custo,
      taxaDescarte: { ...descarte, teto: TETO_DESCARTE_PRD },
      tempoAtePrimeiroCardSegundos: tempo,
      falhasPorTipoDocumento: porTipo,
      topErros: erros,
      taxaFalhaJobs: razao(falhas, finalizados),
      taxaReparoJson: razao(reparo.reparos, reparo.formulacoes),
      taxaReprovacaoCloze: razao(reparo.reformulacoesCloze, reparo.formulacoes),
      estagios,
    };
  }

  private async custoPorBaralho(desde: Date): Promise<Percentis> {
    const { rows } = await this.db.execute<Linha>(sql`
      SELECT COUNT(*)::int AS amostras,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY j.custo_centavos)::float8 AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY j.custo_centavos)::float8 AS p95
      FROM jobs j
      WHERE j.status IN ('concluido', 'parcial') AND j.amostra = false AND j.created_at >= ${desde}`);
    return this.percentis(rows[0]);
  }

  private async descarte(desde: Date): Promise<{ taxa: number | null; descartados: number; total: number; jobs: number }> {
    const { rows } = await this.db.execute<Linha>(sql`
      SELECT COUNT(*) FILTER (WHERE c.estado = 'descartado')::int AS descartados,
             COUNT(*)::int AS total,
             COUNT(DISTINCT j.id)::int AS jobs
      FROM cards c
      JOIN jobs j ON j.id = c.job_id
      WHERE j.created_at >= ${desde}
        AND EXISTS (SELECT 1 FROM exports e WHERE e.job_id = j.id)`);
    const linha = rows[0];
    const descartados = Number(linha.descartados);
    const total = Number(linha.total);
    return { taxa: razao(descartados, total), descartados, total, jobs: Number(linha.jobs) };
  }

  private async tempoAtePrimeiroCard(desde: Date): Promise<Percentis> {
    const { rows } = await this.db.execute<Linha>(sql`
      SELECT COUNT(*)::int AS amostras,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (j.finished_at - j.created_at))::float8)::float8 AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (j.finished_at - j.created_at))::float8)::float8 AS p95
      FROM jobs j
      WHERE j.amostra = true AND j.status = 'concluido' AND j.finished_at IS NOT NULL AND j.created_at >= ${desde}`);
    return this.percentis(rows[0]);
  }

  private async falhasPorTipo(desde: Date): Promise<Metricas['falhasPorTipoDocumento']> {
    const { rows } = await this.db.execute<Linha>(sql`
      SELECT d.tipo::text AS tipo,
             COUNT(*) FILTER (WHERE j.status = 'falhou')::int AS falhas,
             COUNT(*)::int AS total
      FROM jobs j
      JOIN documents d ON d.id = j.document_id
      WHERE j.status IN ('concluido', 'parcial', 'falhou') AND j.created_at >= ${desde}
      GROUP BY d.tipo
      ORDER BY d.tipo`);
    return rows.map((l) => {
      const falhas = Number(l.falhas);
      const total = Number(l.total);
      return { tipo: String(l.tipo), falhas, total, taxa: razao(falhas, total) };
    });
  }

  private async topErros(desde: Date): Promise<Metricas['topErros']> {
    const { rows } = await this.db.execute<Linha>(sql`
      SELECT d.tipo::text AS tipo, j.erro AS mensagem, COUNT(*)::int AS ocorrencias
      FROM jobs j
      JOIN documents d ON d.id = j.document_id
      WHERE j.status = 'falhou' AND j.erro IS NOT NULL AND j.created_at >= ${desde}
      GROUP BY d.tipo, j.erro
      ORDER BY ocorrencias DESC, d.tipo, j.erro
      LIMIT 10`);
    return rows.map((l) => ({ tipo: String(l.tipo), mensagem: String(l.mensagem), ocorrencias: Number(l.ocorrencias) }));
  }

  private async chamadasLlm(desde: Date): Promise<{
    reparos: number;
    reformulacoesCloze: number;
    formulacoes: number;
  }> {
    const { rows } = await this.db.execute<Linha>(sql`
      SELECT COUNT(*) FILTER (WHERE l.estagio = 'reparo')::int AS reparos,
             COUNT(*) FILTER (WHERE l.estagio = 'reformulacao_cloze')::int AS reformulacoes_cloze,
             COUNT(*) FILTER (WHERE l.estagio = 'formulacao')::int AS formulacoes
      FROM llm_calls l
      WHERE l.created_at >= ${desde}`);
    const linha = rows[0];
    return {
      reparos: Number(linha.reparos),
      reformulacoesCloze: Number(linha.reformulacoes_cloze),
      formulacoes: Number(linha.formulacoes),
    };
  }

  private async porEstagio(desde: Date): Promise<Metricas['estagios']> {
    const { rows } = await this.db.execute<Linha>(sql`
      SELECT l.estagio AS estagio,
             COUNT(*)::int AS chamadas,
             SUM(l.tokens_in)::float8 AS tokens_in,
             SUM(l.tokens_out)::float8 AS tokens_out,
             SUM(l.custo_centavos)::float8 AS custo_centavos,
             AVG(l.latencia_ms)::float8 AS latencia_media_ms
      FROM llm_calls l
      WHERE l.created_at >= ${desde}
      GROUP BY l.estagio
      ORDER BY l.estagio`);
    return rows.map((l) => ({
      estagio: String(l.estagio),
      chamadas: Number(l.chamadas),
      tokensIn: Number(l.tokens_in),
      tokensOut: Number(l.tokens_out),
      custoCentavos: Number(l.custo_centavos),
      latenciaMediaMs: numero(l.latencia_media_ms),
    }));
  }

  private percentis(linha: Linha): Percentis {
    return { amostras: Number(linha.amostras), p50: numero(linha.p50), p95: numero(linha.p95) };
  }
}
