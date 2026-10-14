/**
 * Executa `tarefa` sobre os itens, no máximo `limite` ao mesmo tempo, na ordem dos itens.
 * `deveParar` é consultado antes de iniciar cada item; o que já começou sempre termina.
 * Se uma tarefa lançar, nenhum item novo começa, as demais terminam e o primeiro erro é relançado.
 */
export async function executarEmPool<T>(
  itens: readonly T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<void>,
  deveParar: () => boolean = () => false,
): Promise<void> {
  let proximo = 0;
  let falhou = false;
  let primeiroErro: unknown;

  const trabalhador = async (): Promise<void> => {
    while (!falhou && !deveParar() && proximo < itens.length) {
      const indice = proximo++;
      try {
        await tarefa(itens[indice]!, indice);
      } catch (erro) {
        if (!falhou) primeiroErro = erro;
        falhou = true;
      }
    }
  };

  const trabalhadores = Math.max(1, Math.min(limite, itens.length));
  await Promise.all(Array.from({ length: trabalhadores }, trabalhador));
  if (falhou) throw primeiroErro;
}
