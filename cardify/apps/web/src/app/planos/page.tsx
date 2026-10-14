import type { Metadata } from 'next';
import { PlanosCliente } from '../../components/conta/PlanosCliente';
import { caminhoRetornoSeguro, primeiroValor } from '../../components/conta/retorno';

export const metadata: Metadata = {
  title: 'Planos — Cardify',
};

export default async function PaginaPlanos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const informado = primeiroValor(parametros.retorno);
  const retorno = caminhoRetornoSeguro(informado, '/conta');
  const caminhoAtual = informado ? `/planos?retorno=${encodeURIComponent(retorno)}` : '/planos';

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <PlanosCliente retorno={retorno} caminhoAtual={caminhoAtual} />
    </main>
  );
}
