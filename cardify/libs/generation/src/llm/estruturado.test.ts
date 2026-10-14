/* eslint-disable @typescript-eslint/no-explicit-any -- JSON de teste sem tipo */
import { z } from 'zod';
import { RespostaLlmInvalidaError, OrcamentoEsgotadoError, type RegistroChamadaLlm } from '@cardify/shared';
import { LlmClienteRegistrado } from './cliente';
import { chamarEstruturado } from './estruturado';
import { FakeLlmProvider } from './fake';
import { OrcamentoJob } from './orcamento';

const schema = z.object({ nome: z.string().min(2), idade: z.number().int() });
const req = {
  tier: 'economico' as const,
  sistema: 'extraia',
  mensagens: [{ papel: 'user' as const, conteudo: '<documento>texto secreto do documento</documento>' }],
  maxTokens: 500,
};

function montar(respostas: string[], teto = 1000) {
  const registros: RegistroChamadaLlm[] = [];
  const espiao = vi.spyOn(FakeLlmProvider.prototype, 'completar');
  const cliente = new LlmClienteRegistrado(new FakeLlmProvider({ respostas }), { registrar: async (r) => void registros.push(r) });
  const ctx = { jobId: 'j1', estagio: 'extracao' as const, orcamento: new OrcamentoJob(teto) };
  return { cliente, ctx, registros, espiao };
}

afterEach(() => vi.restoreAllMocks());

describe('chamarEstruturado', () => {
  it('sucesso direto, tolerando cerca e texto em volta', async () => {
    const { cliente, ctx, registros } = montar(['Aqui:\n```json\n{"nome":"Ana","idade":30}\n```\nFim']);
    const r = await chamarEstruturado(cliente, ctx, req, schema);
    expect(r).toEqual({ valor: { nome: 'Ana', idade: 30 }, reparado: false });
    expect(registros).toHaveLength(1);
  });

  it('envia o jsonSchema derivado do zod', async () => {
    const { cliente, ctx, espiao } = montar(['{"nome":"Ana","idade":30}']);
    await chamarEstruturado(cliente, ctx, req, schema);
    const enviado = espiao.mock.calls[0]![0].jsonSchema as any;
    expect(enviado.additionalProperties).toBe(false);
    expect(enviado.required).toEqual(['nome', 'idade']);
  });

  it('reparo bem-sucedido: estagio reparo, sem reenviar o documento', async () => {
    const { cliente, ctx, registros, espiao } = montar(['{"nome":"A","idade":"x"}', '{"nome":"Ana","idade":30}']);
    const r = await chamarEstruturado(cliente, ctx, req, schema);
    expect(r).toEqual({ valor: { nome: 'Ana', idade: 30 }, reparado: true });
    expect(registros.map((x) => x.estagio)).toEqual(['extracao', 'reparo']);
    const reqReparo = espiao.mock.calls[1]![0];
    expect(reqReparo.tier).toBe('economico');
    expect(reqReparo.sistema).toBe('Você corrige JSON. Responda apenas com o JSON corrigido.');
    const conteudo = reqReparo.mensagens.map((m) => m.conteudo).join('\n');
    expect(conteudo).not.toContain('<documento>');
    expect(conteudo).not.toContain('texto secreto');
    expect(conteudo).toContain('{"nome":"A","idade":"x"}');
    expect(conteudo).toContain('nome');
    expect(conteudo).toContain('idade');
    expect(ctx.estagio).toBe('extracao');
  });

  it('JSON não parseável também aciona reparo', async () => {
    const { cliente, ctx } = montar(['isto não é json', '{"nome":"Ana","idade":1}']);
    const r = await chamarEstruturado(cliente, ctx, req, schema);
    expect(r.reparado).toBe(true);
  });

  it('falha dupla lança RespostaLlmInvalidaError', async () => {
    const { cliente, ctx, registros } = montar(['{"nome":1}', '{"nome":2}']);
    const erro = await chamarEstruturado(cliente, ctx, req, schema).catch((e) => e);
    expect(erro).toBeInstanceOf(RespostaLlmInvalidaError);
    expect(erro.textoBruto).toBe('{"nome":2}');
    expect(registros).toHaveLength(2);
  });

  it('OrcamentoEsgotadoError propaga', async () => {
    const provider = new FakeLlmProvider({ respostas: ['{}'] });
    const cliente = new LlmClienteRegistrado(provider, { registrar: async () => undefined }, { modeloPorTier: { economico: 'claude-opus-5-5' } });
    const ctx = { jobId: 'j', estagio: 'extracao' as const, orcamento: new OrcamentoJob(0.0001) };
    await expect(chamarEstruturado(cliente, ctx, req, schema)).rejects.toBeInstanceOf(OrcamentoEsgotadoError);
  });
});
