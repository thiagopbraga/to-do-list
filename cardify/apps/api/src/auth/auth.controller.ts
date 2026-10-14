import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { type Db, eq, users } from '@cardify/db';
import { type Env } from '@cardify/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodPipe } from '../comum/zod.pipe';
import { DB, ENV, RESOLVEDOR_SESSAO } from '../infra/tokens';
import type { ResolvedorSessao } from '../sessao/dono';
import { Publica } from '../sessao/sessao.guard';
import type { ClienteGoogle } from './cliente-google';
import {
  COOKIE_OAUTH_RETORNO,
  COOKIE_OAUTH_STATE,
  COOKIE_OAUTH_VERIFIER,
  OAUTH_TTL_SEGUNDOS,
} from './constantes';
import { lerCookieAssinado, limparCookies, opcoesCookie } from './cookies';
import { LoginService } from './login.service';
import { type PedirMagicLink, PedirMagicLinkSchema } from './schemas';
import { SessoesService } from './sessoes.service';
import { CLIENTE_GOOGLE } from './tokens';
import { ehUuid, iguais, retornoSeguro } from './util';

const texto = (valor: unknown): string | undefined => (typeof valor === 'string' && valor ? valor : undefined);

@Controller()
export class AuthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(RESOLVEDOR_SESSAO) private readonly resolvedor: ResolvedorSessao,
    @Inject(CLIENTE_GOOGLE) private readonly google: ClienteGoogle | null,
    private readonly sessoes: SessoesService,
    private readonly login: LoginService,
  ) {}

  @Publica()
  @HttpCode(204)
  @Post('sessao/anonima')
  async sessaoAnonima(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply): Promise<void> {
    if (await this.resolvedor.resolver(req)) return;
    await this.sessoes.criarAnonima(req, res);
  }

  @Publica()
  @Get('me')
  async me(@Req() req: FastifyRequest) {
    const dono = await this.resolvedor.resolver(req);
    if (dono?.userId && ehUuid(dono.userId)) {
      const [usuario] = await this.db
        .select({ id: users.id, email: users.email, nome: users.nome })
        .from(users)
        .where(eq(users.id, dono.userId));
      if (usuario) return { usuario, anonimo: false };
    }
    return { usuario: null, anonimo: !!dono?.anonSessionId };
  }

  @Publica()
  @Get('auth/google')
  async iniciarGoogle(@Query('retorno') retorno: unknown, @Res() res: FastifyReply): Promise<void> {
    const google = this.exigirGoogle();
    const { url, state, codeVerifier } = await google.iniciar();
    const opcoes = opcoesCookie(this.env, OAUTH_TTL_SEGUNDOS, true);
    void res.setCookie(COOKIE_OAUTH_STATE, state, opcoes);
    void res.setCookie(COOKIE_OAUTH_VERIFIER, codeVerifier, opcoes);
    void res.setCookie(COOKIE_OAUTH_RETORNO, retornoSeguro(retorno), opcoes);
    void res.redirect(url.toString(), 302);
  }

  @Publica()
  @Get('auth/google/callback')
  async callbackGoogle(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const google = this.exigirGoogle();
    const stateCookie = lerCookieAssinado(req, COOKIE_OAUTH_STATE);
    const verifier = lerCookieAssinado(req, COOKIE_OAUTH_VERIFIER);
    const retorno = lerCookieAssinado(req, COOKIE_OAUTH_RETORNO);
    limparCookies(res, COOKIE_OAUTH_STATE, COOKIE_OAUTH_VERIFIER, COOKIE_OAUTH_RETORNO);

    const falhou = () => void res.redirect(this.login.urlErro('google_falhou'), 302);
    const codigo = texto(code);
    const stateRecebido = texto(state);
    if (!codigo || !stateRecebido || !stateCookie || !verifier || !iguais(stateRecebido, stateCookie)) return falhou();

    let userId: string | null;
    try {
      const perfil = await google.trocarCodigo(codigo, verifier);
      if (!perfil.emailVerificado || !perfil.email) return falhou();
      userId = await this.login.entrarComGoogle(perfil);
    } catch {
      return falhou();
    }
    if (!userId) return falhou();

    await this.sessoes.concluirLogin(req, res, userId);
    void res.redirect(this.login.destinoAposLogin(retorno), 302);
  }

  @Publica()
  @HttpCode(204)
  @Post('auth/email')
  async pedirEmail(@Body(new ZodPipe(PedirMagicLinkSchema)) corpo: PedirMagicLink): Promise<void> {
    await this.login.pedirMagicLink(corpo.email, corpo.retorno);
  }

  @Publica()
  @Get('auth/email/verificar')
  async verificarEmail(
    @Query('token') token: unknown,
    @Query('retorno') retorno: unknown,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const valor = texto(token);
    const userId = valor ? await this.login.verificarMagicLink(valor) : null;
    if (!userId) return void res.redirect(this.login.urlErro('link_invalido'), 302);

    await this.sessoes.concluirLogin(req, res, userId);
    void res.redirect(this.login.destinoAposLogin(retorno), 302);
  }

  @Publica()
  @HttpCode(204)
  @Post('auth/sair')
  async sair(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply): Promise<void> {
    await this.sessoes.encerrar(req, res);
  }

  private exigirGoogle(): ClienteGoogle {
    if (!this.google) throw new ServiceUnavailableException({ erro: 'google_indisponivel' });
    return this.google;
  }
}
