import { useState } from 'react';
import { augustineAvailable, augustineBook, augustineManifest } from '../lib/content';
import { Async, useAsync } from '../components/ui';

export default function AugustinePage({ initialBook = 1, initialChapter = 1 }: { initialBook?: number; initialChapter?: number }) {
  const [book, setBook] = useState(initialBook);
  const [chapter, setChapter] = useState(initialChapter);
  const manifest = useAsync(augustineManifest, []);
  const data = useAsync(() => augustineBook(book), [book]);
  if (!augustineAvailable()) return <p className="p-5">Confissões de Agostinho não consta do acervo disponível.</p>;
  return <section className="mx-auto max-w-reading space-y-4 p-5">
    <h2 className="text-xl font-semibold">Confissões de Agostinho</h2>
    <Async state={manifest}>{(m) => m ? <p className="text-sm text-muted">{m.chapterCount} capítulos no acervo · {m.edition || m.translator || m.source || ''}</p> : null}</Async>
    <div className="flex flex-wrap gap-3">
      <label>Livro <select value={book} onChange={(e) => { setBook(Number(e.target.value)); setChapter(1); }}
        className="ml-2 rounded-lg border border-outline bg-surface px-3 py-2">
        {Array.from({ length: 13 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select></label>
    </div>
    <Async state={data}>{(result) => !result ? <p>Livro não encontrado.</p> :
      <article className="space-y-4">
        <label>Capítulo <select value={chapter} onChange={(e) => setChapter(Number(e.target.value))}
          className="ml-2 rounded-lg border border-outline bg-surface px-3 py-2">
          {result.chapters.map((c) => <option key={c.chapter} value={c.chapter}>{c.chapter}</option>)}
        </select></label>
        {result.chapters.filter((c) => c.chapter === chapter).map((c) => <div key={c.chapter}>
          <h3 className="mb-3 text-xl font-semibold">{c.title || `Capítulo ${c.chapter}`}</h3>
          <div className="whitespace-pre-wrap font-reading leading-relaxed">{c.body}</div>
          {!!c.footnotes?.length && <details className="mt-4"><summary>Notas</summary>
            {c.footnotes.map((n) => <p key={n.number} className="my-2 text-sm">{n.number}. {n.text}</p>)}</details>}
        </div>)}
      </article>}</Async>
  </section>;
}
