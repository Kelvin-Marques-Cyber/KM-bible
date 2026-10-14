import { useMemo, useState } from 'react';
import { moduleDocuments, modules, type DocumentRow } from '../lib/content';
import { useAsync, Async, ErrorBox } from '../components/ui';
import { openDocument } from './open';
import { useApp } from '../lib/app';

const wanted = /devoc|spurgeon|jornada|morning|manha|manhã|bessa/i;

export default function DevotionalsPage() {
  useApp();
  const candidates = useMemo(() => modules(undefined, true).filter((m) => wanted.test([m.id, m.title, m.kind].join(' '))), []);
  const [selected, setSelected] = useState(candidates[0]?.id ?? '');
  const state = useAsync(() => selected ? moduleDocuments(selected) : Promise.resolve([] as DocumentRow[]), [selected]);
  return <section className="mx-auto max-w-3xl space-y-4 p-5">
    <h2 className="text-xl font-semibold">Devocionais</h2>
    <p className="text-sm text-muted">Escolha um acervo e abra a meditação desejada.</p>
    {candidates.length ? <label className="block">Coleção
      <select value={selected} onChange={(e) => setSelected(e.target.value)}
        className="mt-2 block w-full rounded-lg border border-outline bg-surface p-3">
        {candidates.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </label> : <p>Nenhum módulo de devocionais está ativo nesta instalação.</p>}
    <Async state={state}>{(docs) => <div className="space-y-2">{docs.map((d) =>
      <button type="button" key={d.id} onClick={() => openDocument(d)}
        className="block w-full rounded-lg border border-outline p-3 text-left hover:bg-surface-high">
        {d.pt?.title || d.title}
      </button>)}{docs.length === 0 && <p className="text-sm text-muted">Esta coleção não contém textos disponíveis.</p>}</div>}</Async>
  </section>;
}

export function DevotionalReader({ moduleId, documentId }: { moduleId: string; documentId?: string }) {
  const state = useAsync(() => moduleDocuments(moduleId), [moduleId]);
  return <Async state={state}>{(docs) => {
    const doc = docs.find((d) => d.id === documentId) ?? docs[0];
    if (!doc) return <p className="p-5">Nenhum devocional encontrado nesta coleção.</p>;
    return <article className="space-y-3 p-5">
      <h2 className="text-xl font-semibold">{doc.pt?.title || doc.title}</h2>
      <div className="whitespace-pre-wrap font-reading leading-relaxed">{doc.pt?.body || doc.body}</div>
      {docs.length > 1 && <button type="button" className="underline" onClick={() => openDocument(doc)}>Abrir em modo de estudo</button>}
    </article>;
  }}</Async>;
}
