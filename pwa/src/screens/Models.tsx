// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export function ModelsPage({ reference }: { reference?: Ref }) {
  return <p className="p-6 text-muted">Em construção: ModelsPage</p>;
}

export function ModelPage({ model }: { model: Model3D }) {
  return <p className="p-6 text-muted">Em construção: ModelPage</p>;
}
