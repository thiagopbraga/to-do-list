import { z } from 'zod';

export const CriarUploadSchema = z.object({
  nome: z.string().min(1).max(200),
  bytes: z.number().int().positive(),
  contentType: z.literal('application/pdf'),
});
export type CriarUpload = z.infer<typeof CriarUploadSchema>;

export const IDEMPOTENCY_KEY_MAX = 200;
