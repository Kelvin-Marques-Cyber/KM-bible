// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export function DocumentPage({ document }: { document: DocumentRow }) {
  return <p className="p-6 text-muted">Em construção: DocumentPage</p>;
}

export function LongStudyText({ text }: { text: string }) {
  return <p className="p-6 text-muted">Em construção: LongStudyText</p>;
}
