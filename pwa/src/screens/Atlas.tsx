// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export default function AtlasPage({ focus }: { focus?: string }) {
  return <p className="p-6 text-muted">Em construção: AtlasPage</p>;
}

export function PlacePage({ id }: { id: string }) {
  return <p className="p-6 text-muted">Em construção: PlacePage</p>;
}
