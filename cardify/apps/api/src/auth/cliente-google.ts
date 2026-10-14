/** Parte de `Google` (arctic) usada aqui; evita importar tipos de um pacote ESM em código CommonJS. */
interface GoogleArctic {
  createAuthorizationURL(state: string, codeVerifier: string, escopos: string[]): URL;
  validateAuthorizationCode(codigo: string, codeVerifier: string): Promise<{ idToken(): string }>;
}

export interface PerfilGoogle {
  sub: string;
  email: string;
  emailVerificado: boolean;
  nome: string | null;
}

export interface InicioLoginGoogle {
  url: URL;
  state: string;
  codeVerifier: string;
}

/** Fronteira com o Google: testes injetam um falso em `CLIENTE_GOOGLE`. */
export interface ClienteGoogle {
  iniciar(): Promise<InicioLoginGoogle>;
  trocarCodigo(codigo: string, codeVerifier: string): Promise<PerfilGoogle>;
}

export const ESCOPOS_GOOGLE = ['openid', 'email', 'profile'];

export function perfilDeClaims(claims: unknown): PerfilGoogle {
  const c = claims as { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown };
  if (typeof c.sub !== 'string' || typeof c.email !== 'string') throw new Error('id token sem sub/email');
  return {
    sub: c.sub,
    email: c.email,
    emailVerificado: c.email_verified === true,
    nome: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : null,
  };
}

export class ClienteGoogleArctic implements ClienteGoogle {
  private google: GoogleArctic | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  // arctic é somente ESM: carregado sob demanda (docs/CONVENCOES.md).
  private async cliente(): Promise<GoogleArctic> {
    if (!this.google) {
      const { Google } = await import('arctic');
      this.google = new Google(this.clientId, this.clientSecret, this.redirectUri);
    }
    return this.google;
  }

  async iniciar(): Promise<InicioLoginGoogle> {
    const { generateCodeVerifier, generateState } = await import('arctic');
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = (await this.cliente()).createAuthorizationURL(state, codeVerifier, ESCOPOS_GOOGLE);
    return { url, state, codeVerifier };
  }

  async trocarCodigo(codigo: string, codeVerifier: string): Promise<PerfilGoogle> {
    const { decodeIdToken } = await import('arctic');
    const tokens = await (await this.cliente()).validateAuthorizationCode(codigo, codeVerifier);
    return perfilDeClaims(decodeIdToken(tokens.idToken()));
  }
}
