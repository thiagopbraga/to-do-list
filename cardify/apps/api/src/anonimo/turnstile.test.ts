import { TURNSTILE_SITEVERIFY_URL, VerificadorTurnstileCloudflare } from './turnstile';

describe('VerificadorTurnstileCloudflare', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia secret, response e remoteip como form e aceita success=true', async () => {
    const fetchFake = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetchFake);

    expect(await new VerificadorTurnstileCloudflare('seg').verificar('tok', '1.2.3.4')).toBe(true);

    const [url, init] = fetchFake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({ secret: 'seg', response: 'tok', remoteip: '1.2.3.4' });
  });

  it('falha fechado: success=false, HTTP de erro, rede e ausência de secret', async () => {
    const verificador = new VerificadorTurnstileCloudflare('seg');
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ success: false })));
    expect(await verificador.verificar('tok', undefined)).toBe(false);
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }));
    expect(await verificador.verificar('tok', undefined)).toBe(false);
    vi.stubGlobal('fetch', async () => {
      throw new Error('rede');
    });
    expect(await verificador.verificar('tok', undefined)).toBe(false);
    expect(await new VerificadorTurnstileCloudflare(undefined).verificar('tok', undefined)).toBe(false);
  });
});
