import { OrcamentoEsgotadoError, type LlmProvider, type LlmRequisicao, type RegistroChamadaLlm } from '@cardify/shared';
import { LlmClienteRegistrado } from './cliente';
import { OrcamentoJob } from './orcamento';
import { custoCentavos } from './precos';

const req: LlmRequisicao = {
  tier: 'economico',
  sistema: 'x'.repeat(350),
  mensagens: [{ papel: 'user', conteudo: 'y'.repeat(350) }],
  maxTokens: 1000,
};

function ledgerEmMemoria() {
  const registros: RegistroChamadaLlm[] = [];
  return { registros, registrar: async (r: RegistroChamadaLlm) => void registros.push(r) };
}

describe('LlmClienteRegistrado', () => {
  it('grava no ledger o custo real e ajusta o orçamento', async () => {
    const provider: LlmProvider = {
      completar: async () => ({ texto: 'ok', modelo: 'claude-haiku-5-5', tokensIn: 500, tokensOut: 100, latenciaMs: 42 }),
    };
    const ledger = ledgerEmMemoria();
    const orcamento = new OrcamentoJob(100);
    const cliente = new LlmClienteRegistrado(provider, ledger);

    const resposta = await cliente.chamar({ jobId: 'job-1', estagio: 'extracao', orcamento }, req);

    const real = custoCentavos('claude-haiku-5-5', 500, 100);
    expect(resposta.texto).toBe('ok');
    expect(ledger.registros).toEqual([
      { jobId: 'job-1', estagio: 'extracao', modelo: 'claude-haiku-5-5', tokensIn: 500, tokensOut: 100, custoCentavos: real, latenciaMs: 42 },
    ]);
    expect(orcamento.gastoCentavos).toBeCloseTo(real, 9);
  });

  it('estima com ceil(chars/3,5) tokens de entrada + maxTokens de saída', async () => {
    let gastoDuranteChamada = 0;
    const orcamento = new OrcamentoJob(100);
    const provider: LlmProvider = {
      completar: async () => {
        gastoDuranteChamada = orcamento.gastoCentavos;
        return { texto: '', modelo: 'fake', tokensIn: 0, tokensOut: 0, latenciaMs: 0 };
      },
    };
    await new LlmClienteRegistrado(provider, ledgerEmMemoria()).chamar({ jobId: 'j', estagio: 'extracao', orcamento }, req);
    expect(gastoDuranteChamada).toBeCloseTo(custoCentavos('claude-haiku-5-5', 200, 1000), 9);
    expect(orcamento.gastoCentavos).toBe(0);
  });

  it('usa modeloPorTier para estimar', async () => {
    let gasto = 0;
    const orcamento = new OrcamentoJob(1000);
    const provider: LlmProvider = {
      completar: async () => {
        gasto = orcamento.gastoCentavos;
        return { texto: '', modelo: 'fake', tokensIn: 0, tokensOut: 0, latenciaMs: 0 };
      },
    };
    const cliente = new LlmClienteRegistrado(provider, ledgerEmMemoria(), { modeloPorTier: { economico: 'claude-opus-5-5' }, usdBrl: 6 });
    await cliente.chamar({ jobId: 'j', estagio: 'extracao', orcamento }, req);
    expect(gasto).toBeCloseTo(custoCentavos('claude-opus-5-5', 200, 1000, 6), 9);
  });

  it('estoura o orçamento antes de chamar o provider', async () => {
    const completar = vi.fn();
    const ledger = ledgerEmMemoria();
    const cliente = new LlmClienteRegistrado({ completar }, ledger);
    const orcamento = new OrcamentoJob(0.001);

    await expect(cliente.chamar({ jobId: 'j', estagio: 'extracao', orcamento }, req)).rejects.toBeInstanceOf(OrcamentoEsgotadoError);
    expect(completar).not.toHaveBeenCalled();
    expect(ledger.registros).toHaveLength(0);
    expect(orcamento.gastoCentavos).toBe(0);
  });

  it('erro do provider libera a reserva e propaga', async () => {
    const provider: LlmProvider = { completar: async () => { throw new Error('rede'); } };
    const ledger = ledgerEmMemoria();
    const orcamento = new OrcamentoJob(100);
    const cliente = new LlmClienteRegistrado(provider, ledger);

    await expect(cliente.chamar({ jobId: 'j', estagio: 'extracao', orcamento }, req)).rejects.toThrow('rede');
    expect(orcamento.gastoCentavos).toBe(0);
    expect(ledger.registros).toHaveLength(0);
  });
});
