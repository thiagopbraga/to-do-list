import type { Metadata } from 'next';
import { EntrarCliente } from '../../components/conta/EntrarCliente';
import { caminhoRetornoSeguro, primeiroValor } from '../../components/conta/retorno';

export const metadata: Metadata = {
  title: 'Entrar — Cardify',
};

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const retorno = caminhoRetornoSeguro(primeiroValor(parametros.retorno));
  const erro = primeiroValor(parametros.erro) ?? null;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <EntrarCliente retorno={retorno} erro={erro} />
    </main>
  );
}
