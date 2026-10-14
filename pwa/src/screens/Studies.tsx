// ESBOÇO TEMPORÁRIO — substituído pela implementação completa.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Ref } from '../lib/domain';
import type { DocumentRow, Model3D, Study } from '../lib/content';
export type _Stub = [Ref, DocumentRow, Model3D, Study];

export function ConfessionsPage() {
  return <p className="p-6 text-muted">Em construção: ConfessionsPage</p>;
}

export function StudiesBrowser({ apologetic }: { apologetic: boolean }) {
  return <p className="p-6 text-muted">Em construção: StudiesBrowser</p>;
}

export function StudyPage({ study, apologetic }: { study: Study; apologetic: boolean }) {
  return <p className="p-6 text-muted">Em construção: StudyPage</p>;
}

export function ArenaPage() {
  return <p className="p-6 text-muted">Em construção: ArenaPage</p>;
}

export function ApologistsPage() {
  return <p className="p-6 text-muted">Em construção: ApologistsPage</p>;
}

export function SciencePage() {
  return <p className="p-6 text-muted">Em construção: SciencePage</p>;
}

export function ReligionCurriculaPage({ apologetic }: { apologetic?: boolean }) {
  return <p className="p-6 text-muted">Em construção: ReligionCurriculaPage</p>;
}

export function ReligionCoursePage({ target, apologetic }: { target: string; apologetic?: boolean }) {
  return <p className="p-6 text-muted">Em construção: ReligionCoursePage</p>;
}

export function ArgumentComparison({ study }: { study: Study }) {
  return <p className="p-6 text-muted">Em construção: ArgumentComparison</p>;
}
