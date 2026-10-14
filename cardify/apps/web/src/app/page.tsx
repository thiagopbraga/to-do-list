import { EntradaMaterial } from '@/components/entrada-material/entrada-material';

const PASSOS = [
  { titulo: 'Suba o material', texto: 'Envie o PDF da aula ou cole o texto do resumo.' },
  { titulo: 'Revise os cards', texto: 'Edite, descarte ou reordene antes de exportar.' },
  { titulo: 'Exporte o .apkg', texto: 'Abra o arquivo no Anki e os cards entram no seu baralho.' },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Transforme seu PDF em flashcards para o Anki em menos de 2 minutos
        </h1>
        <p className="text-slate-600">
          Cards atômicos, cloze para os detalhes e um baralho .apkg pronto para importar. Pensado para estudantes de medicina e
          concurseiros.
        </p>
      </div>

      <div className="mt-8">
        <EntradaMaterial />
      </div>

      <section aria-labelledby="passos-titulo" className="mt-14">
        <h2 id="passos-titulo" className="text-xl font-semibold">
          Como funciona
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-sm font-semibold text-indigo-700">Passo {indice + 1}</span>
              <h3 className="mt-1 font-semibold">{passo.titulo}</h3>
              <p className="mt-1 text-sm text-slate-600">{passo.texto}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
