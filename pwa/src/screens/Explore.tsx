// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export default function ExplorePage() {
  return <p className="p-6 text-muted">Em construção: ExplorePage</p>;
}

export function TimelinePage({ reference }: { reference?: Ref }) {
  return <p className="p-6 text-muted">Em construção: TimelinePage</p>;
}

export function ContextComparisonPage({ first }: { first: Ref }) {
  return <p className="p-6 text-muted">Em construção: ContextComparisonPage</p>;
}

export function UnitsPage() {
  return <p className="p-6 text-muted">Em construção: UnitsPage</p>;
}
