import { useState } from 'react';
import { fromId, refLabel, type Ref } from '../lib/domain';
import { lexeme, occurrences, wordsAt } from '../lib/content';
import { Async, useAsync, useDebounced } from '../components/ui';
import { navigate } from '../lib/app';
import { openLexeme } from './open';
import { runSearch, SEARCH_MODES, type SearchMode } from '../lib/original-search';

export function OriginalPage({ reference }: { reference: Ref }) {
  const wordState = useAsync(() => wordsAt(reference), [reference.book, reference.chapter, reference.verse]);
  return <section className="mx-auto max-w-3xl space-y-4 p-5">
    <h2 className="text-xl font-semibold">Texto original · {refLabel(reference)}</h2>
    <p className="text-sm text-muted">Selecione uma palavra para consultar o vocabulário, a transliteração e as ocorrências.</p>
    <Async state={wordState}>{(words) => words.length ? <ol className="grid gap-3 sm:grid-cols-2">
      {words.map((word, i) => <li key={i}>
        <button type="button" onClick={() => openLexeme(word.lexeme)}
          className="h-full w-full rounded-xl border border-outline p-4 text-left hover:bg-surface-high">
          <span dir="auto" className="block text-2xl font-semibold">{word.surface}</span>
          <span className="mt-2 block text-sm">{word.transliteration || word.lexeme}</span>
          <span className="block text-sm text-muted">{word.gloss} · {word.lexeme}</span>
          <span className="mt-1 block text-xs text-muted">{word.morphology} · {word.edition}</span>
        </button>
      </li>)}
    </ol> : <p>Nenhum texto interlinear disponível para esta passagem no acervo ativo.</p>}</Async>
  </section>;
}

export function LexemePage({ id }: { id: string }) {
  const info = useAsync(() => lexeme(id), [id]);
  const usage = useAsync(() => occurrences(id), [id]);
  const [limit, setLimit] = useState(30);
  return <section className="mx-auto max-w-3xl space-y-4 p-5">
    <Async state={info}>{(word) => !word ? <p>Verbete não encontrado.</p> : <article className="space-y-3">
      <h2 dir="auto" className="text-3xl font-semibold">{word.lemma} · {word.id}</h2>
      <p>{word.transliteration} · {word.language}</p>
      <p>{word.pt?.gloss || word.gloss}</p>
      <p className="whitespace-pre-wrap font-reading leading-relaxed">{word.pt?.body || word.definition}</p>
      <p className="text-xs text-muted">{word.source}</p>
    </article>}</Async>
    <h3 className="text-lg font-semibold">Ocorrências</h3>
    <Async state={usage}>{(data) => <div className="space-y-2">
      <p className="text-sm text-muted">{data.frequency} ocorrências indexadas.</p>
      {data.rows.slice(0, limit).map((row, i) => <button type="button" key={i}
        className="block w-full rounded-lg border border-outline p-3 text-left"
        onClick={() => { const ref = fromId(row.reference); if (ref) navigate(ref); }}>
        <span className="font-medium">{fromId(row.reference) ? refLabel(fromId(row.reference)!) : row.reference}</span>
        <span className="block text-sm text-muted">{row.surface} · {row.edition} · {row.morphology}</span>
      </button>)}
      {data.rows.length > limit && <button type="button" className="underline" onClick={() => setLimit(limit + 50)}>Mostrar mais</button>}
    </div>}</Async>
  </section>;
}

export function LinguisticSearchPage() {
  const [mode, setMode] = useState<SearchMode>('lemma');
  const [input, setInput] = useState('');
  const query = useDebounced(input.trim(), 300);
  const data = useAsync(() => runSearch(mode, query), [mode, query]);
  return <section className="mx-auto max-w-3xl space-y-4 p-5">
    <h2 className="text-xl font-semibold">Pesquisa nos idiomas originais</h2>
    <label className="block">Tipo de busca
      <select value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}
        className="mt-1 block w-full rounded-lg border border-outline bg-surface p-3">
        {SEARCH_MODES.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <label className="block">Palavra, transliteração ou código Strong
      <input type="search" value={input} onChange={(e) => setInput(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-outline bg-surface p-3" />
    </label>
    <Async state={data}>{(outcome) => <div className="space-y-2">
      <p className="text-sm text-muted">{outcome.matches} correspondências.</p>
      {outcome.suggestions.slice(0, 60).map((row, i) => <button key={i} type="button"
        onClick={() => openLexeme(row.lexeme)} className="block w-full rounded-lg border border-outline p-3 text-left">
        <strong>{row.label}</strong><span className="ml-2 text-sm text-muted">{row.detail}</span>
      </button>)}
      {outcome.rows.slice(0, 100).map((row, i) => <button key={i} type="button"
        onClick={() => { const r = fromId(row.reference); if (r) navigate(r); }}
        className="block w-full rounded-lg border border-outline p-3 text-left">
        {row.reference} · {row.edition} · {row.surface}
      </button>)}
    </div>}</Async>
  </section>;
}
