// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export default function NotesPage() {
  return <p className="p-6 text-muted">Em construção: NotesPage</p>;
}

export function NoteEditor({ noteId }: { noteId: string }) {
  return <p className="p-6 text-muted">Em construção: NoteEditor</p>;
}
