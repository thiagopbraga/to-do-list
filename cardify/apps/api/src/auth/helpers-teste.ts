import { randomUUID } from 'node:crypto';
import { RESOLVEDOR_SESSAO } from '../infra/tokens';
import { criarAppTeste, type AppTeste } from '../testing/app-teste';
import type { ClienteGoogle, InicioLoginGoogle, PerfilGoogle } from './cliente-google';
import { EnviadorEmailMemoria } from './enviador-email';
import { ResolvedorSessaoCookies } from './resolvedor-cookies';
import { CLIENTE_GOOGLE, ENVIADOR_EMAIL } from './tokens';

export class ClienteGoogleFalso implements ClienteGoogle {
  perfil: PerfilGoogle | Error = { sub: 'g-1', email: 'ana@exemplo.com', emailVerificado: true, nome: 'Ana Google' };
  trocas: Array<{ codigo: string; codeVerifier: string }> = [];
  ultimoInicio: InicioLoginGoogle | null = null;

  async iniciar(): Promise<InicioLoginGoogle> {
    const state = `state-${randomUUID()}`;
    this.ultimoInicio = {
      url: new URL(`https://accounts.google.test/auth?state=${state}`),
      state,
      codeVerifier: `verifier-${randomUUID()}`,
    };
    return this.ultimoInicio;
  }

  async trocarCodigo(codigo: string, codeVerifier: string): Promise<PerfilGoogle> {
    this.trocas.push({ codigo, codeVerifier });
    if (this.perfil instanceof Error) throw this.perfil;
    return this.perfil;
  }
}

/** Guarda os cookies como um navegador: aplica `Set-Cookie` das respostas e reenvia no header `cookie`. */
export class Cookies {
  private readonly valores = new Map<string, string>();

  absorver(res: { cookies: Array<{ name: string; value: string }> }): this {
    for (const { name, value } of res.cookies) {
      if (value === '') this.valores.delete(name);
      else this.valores.set(name, value);
    }
    return this;
  }

  definir(nome: string, valor: string): this {
    this.valores.set(nome, valor);
    return this;
  }

  obter(nome: string): string | undefined {
    return this.valores.get(nome);
  }

  copia(): Cookies {
    const c = new Cookies();
    for (const [k, v] of this.valores) c.valores.set(k, v);
    return c;
  }

  get header(): Record<string, string> {
    if (this.valores.size === 0) return {};
    return { cookie: [...this.valores].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ') };
  }
}

export interface AppAuth {
  t: AppTeste;
  email: EnviadorEmailMemoria;
  google: ClienteGoogleFalso;
}

/** App de teste com a resolução de sessão por cookies reais, e-mail e Google falsos. */
export async function criarAppAuth(opcoes: { google?: boolean } = {}): Promise<AppAuth> {
  const email = new EnviadorEmailMemoria();
  const google = new ClienteGoogleFalso();
  const t = await criarAppTeste((b) =>
    b
      .overrideProvider(RESOLVEDOR_SESSAO)
      .useClass(ResolvedorSessaoCookies)
      .overrideProvider(ENVIADOR_EMAIL)
      .useValue(email)
      .overrideProvider(CLIENTE_GOOGLE)
      .useValue(opcoes.google === false ? null : google),
  );
  return { t, email, google };
}

export function tokenDoEmail(email: EnviadorEmailMemoria): string {
  const link = email.ultimaMensagem?.link;
  if (!link) throw new Error('nenhum e-mail enviado');
  return new URL(link).searchParams.get('token') as string;
}

/** Caminho + query (`/v1/auth/email/verificar?...`) do link do último e-mail. */
export function caminhoDoLink(email: EnviadorEmailMemoria): string {
  const url = new URL(email.ultimaMensagem?.link as string);
  return url.pathname + url.search;
}
