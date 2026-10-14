// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export function OriginalPage({ reference }: { reference: Ref }) {
  return <p className="p-6 text-muted">Em construção: OriginalPage</p>;
}

export function LexemePage({ id }: { id: string }) {
  return <p className="p-6 text-muted">Em construção: LexemePage</p>;
}

export function LinguisticSearchPage() {
  return <p className="p-6 text-muted">Em construção: LinguisticSearchPage</p>;
}
