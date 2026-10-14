/** Valida o token do widget Turnstile. Testes substituem o provider `VERIFICADOR_TURNSTILE`. */
export interface VerificadorTurnstile {
  verificar(token: string, ip: string | undefined): Promise<boolean>;
}

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

export class VerificadorTurnstileCloudflare implements VerificadorTurnstile {
  constructor(private readonly secret: string | undefined) {}

  /** Falha fechada: sem secret, erro de rede, timeout ou resposta inesperada contam como token inválido. */
  async verificar(token: string, ip: string | undefined): Promise<boolean> {
    if (!this.secret) return false;
    const corpo = new URLSearchParams({ secret: this.secret, response: token });
    if (ip) corpo.set('remoteip', ip);
    try {
      const resposta = await fetch(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        body: corpo,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) return false;
      const json = (await resposta.json()) as { success?: unknown };
      return json.success === true;
    } catch {
      return false;
    }
  }
}
