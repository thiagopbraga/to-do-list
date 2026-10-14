import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cabecalho } from '@/components/cabecalho';
import { Rodape } from '@/components/rodape';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cardify — flashcards para o Anki a partir do seu PDF',
  description: 'Suba um PDF ou cole um texto e receba um baralho .apkg pronto para o Anki.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <Cabecalho />
        <div className="flex flex-1 flex-col">{children}</div>
        <Rodape />
      </body>
    </html>
  );
}
