import { useState } from 'react';
import { catalog, packUrl, type SearchPack } from '../lib/catalog';
import { fetchJson, fetchOptional } from '../lib/fetcher';
import { fromId, parseRef, refLabel, tokenize } from '../lib/domain';
import { document } from '../lib/content';
import { Async, useAsync, useDebounced } from '../components/ui';
import { navigate } from '../lib/app';
import { openDocument, openLexeme, openTopic, openVerseStudy } from './open';

type SearchRecord = [string, string, string, string, string, string];

function shard(token: string, total: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.slice(0, 2).length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % total;
}
function decode(deltas: number[]): number[] {
  let previous = 0;
  return deltas.map((d) => (previous += d));
}
async function lookup(pack: SearchPack, words: string[], limit: number): Promise<SearchRecord[]> {
  const postings = await Promise.all(words.map(async (word) => {
    const part = await fetchOptional<Record<string, number[]>>(packUrl(pack, `p/${shard(word, pack.shards)}.json`));
    return decode(part?.[word] ?? []);
  }));
  if (postings.some((ids) => ids.length === 0)) return [];
  postings.sort((a, b) => a.length - b.length);
  const others = postings.slice(1).map((ids) => new Set(ids));
  const matches = postings[0].filter((id) => others.every((ids) => ids.has(id))).slice(0, limit);
  const chunks = [...new Set(matches.map((id) => Math.floor(id / pack.chunk)))];
  const records = await Promise.all(chunks.map(async (c) => [c, await fetchJson<SearchRecord[]>(packUrl(pack, `r/${c}.json`))] as const));
  const table = new Map(records);
  return matches.map((id) => table.get(Math.floor(id / pack.chunk))?.[id % pack.chunk]).filter((r): r is SearchRecord => !!r);
}
async function search(query: string): Promise<SearchRecord[]> {
  const words = [...new Set(tokenize(query))].slice(0, 6);
  if (!words.length) return [];
  const [general, comments] = await Promise.all([
    lookup(catalog.search.general, words, 75),
    lookup(catalog.search.commentary, words, 35),
  ]);
  return [...general, ...comments];
}
async function visit(item: SearchRecord) {
  const [category, id, title, , , reference] = item;
  if (category === 'topic') return openTopic(id, title);
  if (category === 'lexicon') return openLexeme(id, title);
  if (category === 'commentary' && reference) {
    const r = fromId(reference);
    if (r) return openVerseStudy(r);
  }
  const doc = await document(id);
  if (doc) return openDocument(doc);
  const r = fromId(reference);
  if (r) navigate(r);
}
export default function SearchPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim(), 250);
  const results = useAsync(() => search(debounced), [debounced]);
  const parsed = parseRef(debounced);
  return <section className="mx-auto max-w-3xl space-y-4 p-5">
    <h2 className="text-xl font-semibold">Pesquisa</h2>
    <label className="block">Palavra, assunto ou referência
      <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex.: graça, justificação, João 3:16"
        className="mt-2 w-full rounded-lg border border-outline bg-surface p-3" />
    </label>
    {parsed && <button type="button" className="w-full rounded-lg bg-primary-container p-3 text-left"
      onClick={() => navigate(parsed)}>Abrir {refLabel(parsed)}</button>}
    {!debounced ? <p className="text-sm text-muted">Pesquise nos estudos, comentários, temas e documentos do acervo.</p> :
      <Async state={results}>{(items) => <div className="space-y-2">
        <p className="text-sm text-muted">{items.length} resultados (mostrando até 110).</p>
        {items.map((item, i) => <button type="button" key={item[0] + item[1] + i}
          onClick={() => void visit(item)}
          className="w-full rounded-xl border border-outline p-3 text-left hover:bg-surface-high">
          <span className="block font-semibold">{item[2]}</span>
          <span className="block text-xs text-muted">{item[4]} · {item[0]}</span>
          <span className="mt-1 block text-sm">{item[3]}</span>
        </button>)}
        {items.length === 0 && <p>Nenhum resultado encontrado.</p>}
      </div>}</Async>}
  </section>;
}
