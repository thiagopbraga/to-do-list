import { z } from 'zod';

export const PedirMagicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  retorno: z.string().max(512).optional(),
});
export type PedirMagicLink = z.infer<typeof PedirMagicLinkSchema>;
