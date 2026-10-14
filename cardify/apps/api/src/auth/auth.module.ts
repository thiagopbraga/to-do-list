import { Module } from '@nestjs/common';
import { type Env } from '@cardify/shared';
import { ENV } from '../infra/tokens';
import { PagamentoModule } from '../pagamento/pagamento.module';
import { AuthController } from './auth.controller';
import { ClienteGoogleArctic } from './cliente-google';
import { ContaController } from './conta.controller';
import { ContaService } from './conta.service';
import { EnviadorEmailPadrao } from './enviador-email';
import { LoginService } from './login.service';
import { SessoesService } from './sessoes.service';
import { CLIENTE_GOOGLE, ENVIADOR_EMAIL } from './tokens';

/** T21 — sessões, login Google e por e-mail, sessão anônima, vínculo do trabalho anônimo e exclusão de conta. */
@Module({
  imports: [PagamentoModule],
  controllers: [AuthController, ContaController],
  providers: [
    SessoesService,
    LoginService,
    ContaService,
    { provide: ENVIADOR_EMAIL, useClass: EnviadorEmailPadrao },
    {
      provide: CLIENTE_GOOGLE,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? new ClienteGoogleArctic(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)
          : null,
    },
  ],
})
export class AuthModule {}
