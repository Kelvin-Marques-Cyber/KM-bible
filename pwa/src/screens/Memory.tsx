// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export default function MemoryPage() {
  return <p className="p-6 text-muted">Em construção: MemoryPage</p>;
}

export function ReviewPage({ cardIds }: { cardIds: string[] | null }) {
  return <p className="p-6 text-muted">Em construção: ReviewPage</p>;
}

export function CreateCard({ reference, text }: { reference: Ref; text: string }) {
  return <p className="p-6 text-muted">Em construção: CreateCard</p>;
}
