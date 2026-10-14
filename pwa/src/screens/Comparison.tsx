// ComparisonPage de lib/reader.dart: o capítulo em várias edições, em colunas
// ou linhas alternadas, com correspondência editorial entre numerações e
// destaque das palavras que não aparecem no versículo da edição de base.
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { app, fontSize, lineHeight, useApp } from '../lib/app';
import { bibleBook, mapped, modules, toRows, type BookData } from '../lib/content';
import { refLabel, ref, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { baseWords, diffSegments, verseText } from '../lib/commentaries-logic';
import { Button, Chip, ErrorBox, Progress, Small, Spinner, Wrap, useAsync } from '../components/ui';

interface Cell {
  edition: string;
  label: string;
  text: string;
  found: boolean;
}
interface Row {
  key: string;
  verse: number;
  base: string;
  cells: Cell[];
}
interface Loaded {
  key: string;
  rows: Row[];
  /** Edições cujo livro não pôde ser lido agora (ex.: sem conexão e fora do cache). */
  failed: string[];
}

const COLUMN_WIDTH = 240;

/** Carrega cada livro de cada edição uma única vez (por tela) e monta as células. */
async function loadComparison(
  cache: Map<string, Promise<BookData | null>>,
  base: string,
  r: Ref,
  editions: string[],
  language: string,
  key: string,
): Promise<Loaded> {
  const book = (edition: string, b: number) => {
    const k = `${edition}:${b}`;
    let p = cache.get(k);
    if (!p) {
      p = bibleBook(edition, b);
      p.catch(() => cache.delete(k));
      cache.set(k, p);
    }
    return p;
  };
  const baseBook = await book(base, r.book);
  const source = baseBook ? toRows(baseBook, r.chapter) : [];
  // Endereço de cada versículo em cada edição (mapeamento editorial quando houver).
  const targets = editions.map((edition) =>
    source.map((row) => {
      const at = ref(row.book, row.chapter, row.verse);
      const m = mapped(base, at, edition);
      return { target: m ?? at, mapped: m !== null };
    }),
  );
  // Um pedido por (edição, livro); uma edição indisponível offline não derruba as demais.
  const needed = new Map<string, [string, number]>();
  editions.forEach((edition, i) => targets[i].forEach((x) => needed.set(`${edition}\u0000${x.target.book}`, [edition, x.target.book])));
  const books = new Map<string, BookData | null>();
  const failed = new Set<string>();
  await Promise.all(
    [...needed].map(async ([k, [edition, b]]) => {
      try {
        books.set(k, await book(edition, b));
      } catch {
        books.set(k, null);
        failed.add(edition);
      }
    }),
  );
  const unavailable = tr('Não foi possível carregar esta edição agora.', 'This edition could not be loaded right now.', 'No se pudo cargar esta edición ahora.');
  const rows = source.map((row, index) => ({
    key: row.reference,
    verse: row.verse,
    base: row.text,
    cells: editions.map((edition, i) => {
      const { target, mapped: isMapped } = targets[i][index];
      const text = verseText(books.get(`${edition}\u0000${target.book}`), target);
      return {
        edition,
        label: `${edition} · ${refLabel(target, language)}${isMapped ? '' : ' *'}`,
        text: text ?? (failed.has(edition) ? unavailable : t('noContent')),
        found: text !== null,
      };
    }),
  }));
  return { key, rows, failed: editions.filter((e) => failed.has(e)) };
}

const VerseCell = memo(function VerseCell({ cell, base, diff, size, height }: { cell: Cell; base: Set<string> | null; diff: boolean; size: number; height: number }) {
  const segments = useMemo(() => (diff && base && cell.found ? diffSegments(cell.text, base) : null), [diff, base, cell]);
  return (
    <div className="min-w-0 p-4">
      <p className="text-sm text-muted">{cell.label}</p>
      <p className={`select-text font-reading ${cell.found ? '' : 'text-muted'}`} style={{ fontSize: size, lineHeight: height }}>
        {segments
          ? segments.map((s, i) =>
              s.changed ? (
                <mark key={i} className="rounded-sm bg-secondary-container text-on-surface">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )
          : cell.text}
      </p>
    </div>
  );
});

const VerseRowView = memo(function VerseRowView({ row, columns, diff, size, height }: { row: Row; columns: boolean; diff: boolean; size: number; height: number }) {
  const base = useMemo(() => (diff ? baseWords(row.base) : null), [diff, row.base]);
  return (
    <div
      role="group"
      aria-label={`${tr('Versículo', 'Verse', 'Versículo')} ${row.verse}`}
      className={columns ? 'grid border-b border-outline/30' : 'border-b border-outline/30'}
      style={columns ? { gridTemplateColumns: `repeat(${row.cells.length}, minmax(0, 1fr))` } : undefined}
    >
      {row.cells.map((cell) => (
        <VerseCell key={cell.edition} cell={cell} base={base} diff={diff} size={size} height={height} />
      ))}
    </div>
  );
});

function Rows({ rows, columns, diff, editions, initialVerse }: { rows: Row[]; columns: boolean; diff: boolean; editions: number; initialVerse: number }) {
  const parent = useRef<HTMLDivElement>(null);
  const size = fontSize();
  const height = lineHeight();
  const perCell = Math.round(size * height * 3 + 52);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => (columns ? perCell + size * height : perCell * Math.max(1, editions)),
    overscan: 4,
    getItemKey: (index) => rows[index]?.key ?? index,
  });
  // Abre no versículo de origem uma vez por capítulo (trocar edições não mexe na rolagem).
  const positioned = useRef('');
  useLayoutEffect(() => {
    const anchor = `${rows[0]?.key ?? ''}|${initialVerse}`;
    if (positioned.current === anchor || rows.length === 0) return;
    positioned.current = anchor;
    const index = rows.findIndex((r) => r.verse === initialVerse);
    if (index > 0) virtual.scrollToIndex(index, { align: 'start' });
    else if (parent.current) parent.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, initialVerse]);
  useEffect(() => {
    virtual.measure();
  }, [columns, diff, editions, size, height, virtual]);

  const items = virtual.getVirtualItems();
  const minWidth = columns && editions > 1 ? editions * COLUMN_WIDTH : undefined;
  return (
    <div ref={parent} className="scroll-area min-h-0 flex-1 overflow-x-auto" tabIndex={0} aria-label={t('compare')}>
      <div className="relative w-full" style={{ height: virtual.getTotalSize() + 24, minWidth }}>
        <div style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}>
          {items.map((item) => (
            <div key={item.key} data-index={item.index} ref={virtual.measureElement}>
              <VerseRowView row={rows[item.index]} columns={columns} diff={diff} size={size} height={height} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ComparisonPage({ reference }: { reference: Ref }) {
  useApp();
  const language = lang();
  const base = app.translation;
  const bibles = modules('bible', true);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set([base]));
  const [columns, setColumns] = useState(false);
  const [diff, setDiff] = useState(false);
  const cache = useRef(new Map<string, Promise<BookData | null>>());
  // Mesma ordem da lista de módulos; edições removidas deixam de aparecer.
  const selected = bibles.filter((m) => chosen.has(m.id)).map((m) => m.id);
  const key = `${base}|${reference.book}:${reference.chapter}|${selected.join(',')}|${language}`;
  const state = useAsync(
    () => loadComparison(cache.current, base, reference, selected, language, key),
    [key],
  );
  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 border-b border-outline/30 px-3 py-3">
        <div className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0" role="group" aria-label={tr('Edições', 'Editions', 'Ediciones')}>
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {bibles.map((m) => (
              <Chip key={m.id} selected={chosen.has(m.id)} onClick={() => toggle(m.id)}>
                <span title={m.title}>{m.id}</span>
              </Chip>
            ))}
          </div>
        </div>
        <Wrap>
          <div role="group" aria-label={tr('Disposição', 'Layout', 'Disposición')} className="flex flex-wrap gap-2">
            <Chip selected={columns} onClick={() => setColumns(true)}>
              {t('columns')}
            </Chip>
            <Chip selected={!columns} onClick={() => setColumns(false)}>
              {t('alternating')}
            </Chip>
          </div>
          <Chip selected={diff} onClick={() => setDiff((v) => !v)}>
            {t('differences')}
          </Chip>
        </Wrap>
        <Small>{t('addressWarning')}</Small>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {state.loading ? t('loading') : ''}
      </div>
      {state.loading && state.data !== undefined && <Progress />}
      {!state.loading && state.data && state.data.failed.length > 0 && (
        <div role="alert" className="mx-3 mt-2 flex shrink-0 flex-wrap items-center gap-x-2 rounded-xl bg-danger/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            {tr('Sem acesso agora a: ', 'Not available right now: ', 'Sin acceso ahora a: ')}
            {state.data.failed.join(', ')}
          </span>
          <Button variant="text" onClick={state.reload}>
            {t('retry')}
          </Button>
        </div>
      )}
      {state.error ? (
        <ErrorBox error={state.error} onRetry={state.reload} />
      ) : state.data === undefined ? (
        <Spinner />
      ) : selected.length === 0 ? (
        <p className="p-5 text-muted">{tr('Selecione ao menos uma edição acima.', 'Select at least one edition above.', 'Seleccione al menos una edición arriba.')}</p>
      ) : state.data.rows.length === 0 ? (
        <p className="p-5 text-muted">{t('noContent')}</p>
      ) : (
        <Rows
          rows={state.data.rows}
          columns={columns}
          diff={diff}
          editions={state.data.rows[0]?.cells.length ?? 1}
          initialVerse={reference.verse}
        />
      )}
    </div>
  );
}
