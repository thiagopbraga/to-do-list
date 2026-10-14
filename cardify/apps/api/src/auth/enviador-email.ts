import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Env } from '@cardify/shared';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV } from '../infra/tokens';

export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
  /** Link de ação da mensagem; em dev sem SMTP é o que vai para o log. */
  link: string;
}

export interface EnviadorEmail {
  enviar(mensagem: MensagemEmail): Promise<void>;
}

/** SMTP via `SMTP_URL`. Sem ela, em dev, apenas registra o link no log. */
@Injectable()
export class EnviadorEmailPadrao implements EnviadorEmail {
  private readonly logger = new Logger('Email');
  private transporte: Transporter | null = null;
  /** Última mensagem enviada (ou registrada em log), para inspeção em dev. */
  ultimaMensagem: MensagemEmail | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.ultimaMensagem = mensagem;
    if (!this.env.SMTP_URL) {
      if (this.env.NODE_ENV === 'production') {
        this.logger.error('SMTP_URL não configurada: e-mail de login não enviado');
        throw new ServiceUnavailableException({ erro: 'email_indisponivel' });
      }
      this.logger.log(`[dev] e-mail para ${mensagem.para}: ${mensagem.assunto} -> ${mensagem.link}`);
      return;
    }
    this.transporte ??= createTransport(this.env.SMTP_URL);
    await this.transporte.sendMail({
      from: this.env.EMAIL_FROM,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
    });
  }
}

/** Para testes: guarda tudo o que seria enviado. */
export class EnviadorEmailMemoria implements EnviadorEmail {
  readonly mensagens: MensagemEmail[] = [];

  get ultimaMensagem(): MensagemEmail | null {
    return this.mensagens.at(-1) ?? null;
  }

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.mensagens.push(mensagem);
  }
}
