'use client';

import { useParams } from 'next/navigation';
import { RevisaoTela } from '@/components/revisao/RevisaoTela';

export default function PaginaRevisao() {
  const { jobId } = useParams<{ jobId: string }>();
  return <RevisaoTela jobId={jobId} />;
}
