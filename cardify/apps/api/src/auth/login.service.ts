import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, type Db, eq, isNull, magicLinks, sql, users } from '@cardify/db';
import { type Env } from '@cardify/shared';
import { DB, ENV } from '../infra/tokens';
import type { PerfilGoogle } from './cliente-google';
import { MAGIC_LINK_TTL_MS, MAGIC_LINKS_POR_HORA } from './constantes';
import { ENVIADOR_EMAIL } from './tokens';
import type { EnviadorEmail } from './enviador-email';
import { normalizarEmail, retornoSeguro, sha256Hex, tokenAleatorio, urlDoApp } from './util';

@Injectable()
export class LoginService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(ENVIADOR_EMAIL) private readonly enviador: EnviadorEmail,
  ) {}

  async pedirMagicLink(emailBruto: string, retorno?: string): Promise<void> {
    const email = normalizarEmail(emailBruto);
    const token = tokenAleatorio();
    const agora = Date.now();

    // O lock por e-mail serializa pedidos concorrentes: sem ele, dois passariam juntos pelo limite.
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`magic-link:${email}`}))`);
      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(magicLinks)
        .where(and(eq(magicLinks.email, email), sql`${magicLinks.createdAt} > ${new Date(agora - 3_600_000)}`));
      if (total >= MAGIC_LINKS_POR_HORA) {
        throw new HttpException({ erro: 'muitas_tentativas' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      await tx.insert(magicLinks).values({
        tokenHash: sha256Hex(token),
        email,
        expiresAt: new Date(agora + MAGIC_LINK_TTL_MS),
      });
    });

    const url = new URL('/v1/auth/email/verificar', this.env.API_URL.replace(/\/+$/, '') + '/');
    url.searchParams.set('token', token);
    if (retorno !== undefined) url.searchParams.set('retorno', retornoSeguro(retorno));
    const link = url.toString();
    await this.enviador.enviar({
      para: email,
      assunto: 'Seu link de acesso ao Cardify',
      texto: `Use o link abaixo para entrar no Cardify. Ele vale por 15 minutos e só pode ser usado uma vez.\n\n${link}\n\nSe você não pediu este e-mail, ignore-o.`,
      link,
    });
  }

  /** Consome o token de forma atômica e devolve o id do usuário, ou null se inválido/usado/expirado. */
  async verificarMagicLink(token: string): Promise<string | null> {
    const agora = new Date();
    const [link] = await this.db
      .update(magicLinks)
      .set({ usadoEm: agora })
      .where(and(eq(magicLinks.tokenHash, sha256Hex(token)), isNull(magicLinks.usadoEm), sql`${magicLinks.expiresAt} > ${agora}`))
      .returning({ email: magicLinks.email });
    if (!link) return null;

    const [usuario] = await this.db
      .insert(users)
      .values({ email: link.email, emailVerificadoEm: agora })
      .onConflictDoUpdate({
        target: users.email,
        set: { emailVerificadoEm: sql`coalesce(${users.emailVerificadoEm}, ${agora})` },
      })
      .returning({ id: users.id });
    return usuario.id;
  }

  /** Acha por `google_sub`, senão por e-mail (gravando o `google_sub`), senão cria. Null se o e-mail já é de outra conta Google. */
  async entrarComGoogle(perfil: PerfilGoogle): Promise<string | null> {
    const email = normalizarEmail(perfil.email);
    const agora = new Date();

    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const [porSub] = await this.db.select({ id: users.id }).from(users).where(eq(users.googleSub, perfil.sub));
      if (porSub) return porSub.id;

      const [porEmail] = await this.db.select().from(users).where(eq(users.email, email));
      if (porEmail) {
        if (porEmail.googleSub && porEmail.googleSub !== perfil.sub) return null;
        await this.db
          .update(users)
          .set({
            googleSub: perfil.sub,
            emailVerificadoEm: porEmail.emailVerificadoEm ?? agora,
            nome: porEmail.nome ?? perfil.nome,
          })
          .where(eq(users.id, porEmail.id));
        return porEmail.id;
      }

      const [criado] = await this.db
        .insert(users)
        .values({ email, nome: perfil.nome, googleSub: perfil.sub, emailVerificadoEm: agora })
        .onConflictDoNothing()
        .returning({ id: users.id });
      if (criado) return criado.id;
    }
    return null;
  }

  destinoAposLogin(retorno: unknown): string {
    return urlDoApp(this.env.APP_URL, retornoSeguro(retorno));
  }

  urlErro(erro: string): string {
    return urlDoApp(this.env.APP_URL, `/entrar?erro=${erro}`);
  }
}
