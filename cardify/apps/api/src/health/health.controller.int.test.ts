import { criarAppTeste, type AppTeste } from '../testing/app-teste';

describe('GET /v1/health', () => {
  let t: AppTeste;

  beforeAll(async () => {
    t = await criarAppTeste();
  });

  afterAll(() => t.fechar());

  it('responde sem sessão', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
