import { ErroApi } from '@/lib/api';

export interface AvisoErro {
  texto: string;
  link?: { href: string; rotulo: string };
}

const LINK_ENTRAR = { href: '/entrar', rotulo: 'Entrar para continuar' };

/** Converte falhas da API em texto para o usuário. Mensagens de documento e de limite vêm prontas da API. */
export function descreverErro(erro: unknown): AvisoErro {
  if (!(erro instanceof ErroApi)) {
    return { texto: 'Não foi possível falar com o Cardify. Verifique sua conexão e tente de novo.' };
  }
  switch (erro.erro) {
    case 'cota_excedida':
      return { texto: 'Você usou a cota de cards deste mês.', link: { href: '/planos', rotulo: 'Ver planos' } };
    case 'limite_diario_ip':
    case 'amostra_indisponivel':
      return { texto: erro.message, link: LINK_ENTRAR };
    case 'turnstile_necessario':
      return { texto: 'Confirme que você não é um robô para continuar.' };
    case 'upload_recusado':
      return { texto: 'O armazenamento recusou o arquivo. Tente enviar de novo.' };
  }
  if (erro.erro.startsWith('documento_')) return { texto: erro.message };
  if (erro.status >= 500) return { texto: 'Algo deu errado do nosso lado. Tente de novo em instantes.' };
  return { texto: 'Não foi possível concluir essa ação. Tente de novo.' };
}
