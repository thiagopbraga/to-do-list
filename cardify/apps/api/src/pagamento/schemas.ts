import { AssinarSchema } from '@cardify/shared';
import { z } from 'zod';

export const AssinarComCpfSchema = AssinarSchema.extend({
  cpfCnpj: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ''))
    .pipe(z.string().regex(/^(\d{11}|\d{14})$/, 'informe um CPF (11 dígitos) ou CNPJ (14 dígitos)')),
});
export type AssinarComCpf = z.infer<typeof AssinarComCpfSchema>;

export const SimularWebhookSchema = z.object({
  providerSubId: z.string().min(1),
  tipo: z.enum(['pagamento_confirmado', 'pagamento_atrasado', 'assinatura_cancelada', 'reembolso']),
});
export type SimularWebhook = z.infer<typeof SimularWebhookSchema>;
