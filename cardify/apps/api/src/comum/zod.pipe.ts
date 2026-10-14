import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/**
 * Valida o corpo com o MESMO schema zod que o front importa de @cardify/shared,
 * em vez de class-validator: uma só fonte para o formato de cada requisição.
 */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(valor: unknown): z.infer<S> {
    const resultado = this.schema.safeParse(valor);
    if (!resultado.success) {
      throw new BadRequestException({
        erro: 'requisicao_invalida',
        detalhes: resultado.error.issues.map((i) => ({ caminho: i.path.join('.'), mensagem: i.message })),
      });
    }
    return resultado.data;
  }
}
