import type { Metadata } from 'next';
import { PainelConta } from '../../components/conta/PainelConta';

export const metadata: Metadata = {
  title: 'Minha conta — Cardify',
};

export default function PaginaConta() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <PainelConta />
    </main>
  );
}
