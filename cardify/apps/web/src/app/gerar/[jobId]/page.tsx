import { Acompanhamento } from '@/components/geracao/acompanhamento';

export default async function PaginaGeracao({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <Acompanhamento jobId={jobId} />
    </main>
  );
}
