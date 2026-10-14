import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { APP_GUARD } from '@nestjs/core';
import { RESOLVEDOR_SESSAO } from '../infra/tokens';
import { DonoAtual, mesmoDono, type Dono } from './dono';
import { ResolvedorSessaoTeste } from './resolvedor-teste';
import { AceitaAnonimo, Publica, SessaoGuard } from './sessao.guard';

@Controller()
class RotasTeste {
  @Publica()
  @Get('publica')
  publica() {
    return { ok: true };
  }

  @Get('logado')
  logado(@DonoAtual() dono: Dono) {
    return dono;
  }

  @AceitaAnonimo()
  @Get('anonimo')
  anonimo(@DonoAtual() dono: Dono) {
    return dono;
  }
}

describe('SessaoGuard', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [RotasTeste],
      providers: [
        { provide: RESOLVEDOR_SESSAO, useValue: new ResolvedorSessaoTeste() },
        { provide: APP_GUARD, useClass: SessaoGuard },
      ],
    }).compile();
    app = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  it('rota pública dispensa sessão', async () => {
    expect((await app.inject({ method: 'GET', url: '/publica' })).statusCode).toBe(200);
  });

  it('rota padrão exige usuário logado', async () => {
    expect((await app.inject({ method: 'GET', url: '/logado' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/logado', headers: { 'x-teste-anon': 'a1' } })).statusCode).toBe(401);
    const res = await app.inject({ method: 'GET', url: '/logado', headers: { 'x-teste-user': 'u1' } });
    expect(res.json()).toEqual({ userId: 'u1', anonSessionId: null });
  });

  it('@AceitaAnonimo aceita sessão anônima', async () => {
    const res = await app.inject({ method: 'GET', url: '/anonimo', headers: { 'x-teste-anon': 'a1' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: null, anonSessionId: 'a1' });
  });

  it('mesmoDono compara usuário ou sessão anônima', () => {
    expect(mesmoDono({ userId: 'u1', anonSessionId: null }, { userId: 'u1', anonSessionId: null })).toBe(true);
    expect(mesmoDono({ userId: 'u1', anonSessionId: null }, { userId: 'u2', anonSessionId: null })).toBe(false);
    expect(mesmoDono({ userId: null, anonSessionId: 'a1' }, { userId: null, anonSessionId: 'a1' })).toBe(true);
    expect(mesmoDono({ userId: null, anonSessionId: 'a1' }, { userId: 'u1', anonSessionId: null })).toBe(false);
  });
});
