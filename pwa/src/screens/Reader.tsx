// Leitor bíblico (ReaderPage de lib/reader.dart): capítulo ou livro inteiro,
// destaques, seleção múltipla, posição lembrada, modo estudo e tela cheia.
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BookmarkPlus,
  Box,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Eraser,
  GitCompare,
  GraduationCap,
  History,
  Languages,
  LibraryBig,
  Link2,
  Maximize,
  MessageSquare,
  Minimize,
  Network,
  NotebookPen,
  PanelsTopLeft,
  Brain,
  Bookmark,
  Columns2,
  X,
  BookOpen,
  ScrollText,
} from 'lucide-react';
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { app, fontSize, isFullscreen, isStudy, lineHeight, margins, navigate, rememberPosition, set, step, useApp } from '../lib/app';
import { bibleBook, hasVerse, mapped, modules, toRows, type VerseRow, firstRefOfBook } from '../lib/content';
import { bookNames, fromId, refId, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { highlight, highlights as loadHighlights, pref, recordReading, savePlace, setPref, subscribe } from '../lib/store';
import { Action, ErrorBox, IconButton, Progress, Spinner, copyText, message } from '../components/ui';
import {
  choosePassage,
  createCard,
  openComparison,
  openCommentaries,
  openContextCompare,
  openCrossReferences,
  openModels,
  openNewNote,
  openOriginal,
  openSavedPlaces,
  openTimeline,
  openVerseStudy,
} from './open';

const CommentariesPanel = lazy(() => import('./Commentaries'));
export const HIGHLIGHT_COLORS = [0xffc857, 0x83bd75, 0x6cacdb, 0xcd91c4];
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

interface Loaded {
  key: string;
  rows: VerseRow[];
  colors: Map<string, number>;
}

function useChapter(translation: string, book: number, chapter: number, whole: boolean, revision: number) {
  const key = `${translation}:${book}:${whole ? 0 : chapter}:${revision}`;
  const [state, setState] = useState<{ loaded: Loaded | null; error: unknown }>({ loaded: null, error: null });
  const [colorTick, setColorTick] = useState(0);
  useEffect(() => subscribe(() => setColorTick((n) => n + 1)), []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await bibleBook(translation, book);
        const rows = data ? toRows(data, whole ? undefined : chapter) : [];
        const colors = await loadHighlights(translation, book);
        if (alive) setState({ loaded: { key, rows, colors }, error: null });
      } catch (error) {
        if (alive) setState({ loaded: null, error });
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, translation, book, chapter, whole]);
  // Destaques mudam sem recarregar o texto.
  useEffect(() => {
    if (!state.loaded || colorTick === 0) return;
    let alive = true;
    loadHighlights(translation, book).then((colors) => {
      if (alive) setState((s) => (s.loaded ? { ...s, loaded: { ...s.loaded, colors } } : s));
    });
    return () => {
      alive = false;
    };
  }, [colorTick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, key, reload: () => setState({ loaded: null, error: null }) };
}

const Verse = memo(function Verse({
  row,
  previous,
  whole,
  picked,
  color,
  onToggle,
  numbers,
  headings,
  red,
  paragraphs,
  size,
}: {
  row: VerseRow;
  previous?: VerseRow;
  whole: boolean;
  picked: boolean;
  color?: number;
  onToggle: (id: string) => void;
  numbers: boolean;
  headings: boolean;
  red: boolean;
  paragraphs: boolean;
  size: number;
}) {
  const language = lang();
  const pieces = useMemo(() => {
    const out: { text: string; red?: boolean }[] = [];
    let cursor = 0;
    if (red) {
      for (const [s0, e0] of row.meta.r ?? []) {
        const s = Math.min(Math.max(s0, cursor), row.text.length);
        const e = Math.min(Math.max(e0, s), row.text.length);
        out.push({ text: row.text.slice(cursor, s) }, { text: row.text.slice(s, e), red: true });
        cursor = e;
      }
    }
    out.push({ text: row.text.slice(cursor) });
    return out;
  }, [row, red]);
  const r = { book: row.book, chapter: row.chapter, verse: row.verse };
  return (
    <div data-ref={row.reference} id={`v-${row.reference.replace(/:/g, '-')}`}>
      {whole && (!previous || previous.chapter !== row.chapter) && (
        <h3 className="py-5 text-2xl font-normal">
          {bookNames(language)[row.book - 1]} {row.chapter}
        </h3>
      )}
      {headings && row.meta.h && <h4 className="py-3.5 text-[17px] font-semibold">{row.meta.h}</h4>}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={picked}
        aria-label={`${refLabel(r, language)}. ${row.text}`}
        onClick={() => onToggle(row.reference)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(row.reference);
          }
        }}
        className={`cursor-pointer rounded-lg px-1.5 font-reading transition-colors ${paragraphs ? 'py-0.5' : 'mb-[7px] py-2'} ${
          paragraphs && row.meta.p ? 'mb-3.5' : ''
        } ${picked ? 'bg-primary-container ring-1 ring-primary' : ''}`}
        style={{
          fontSize: size,
          lineHeight: lineHeight(),
          backgroundColor: !picked && color !== undefined ? `${hex(color)}40` : undefined,
        }}
      >
        {numbers && (
          <span className="select-none align-baseline text-primary" style={{ fontSize: size * 0.65 }}>
            {row.verse}&nbsp;&nbsp;
          </span>
        )}
        {pieces.map((p, i) => (p.red ? <span key={i} className="verse-red">{p.text}</span> : <span key={i}>{p.text}</span>))}
      </div>
    </div>
  );
});

function Toolbar() {
  const a = app;
  const study = isStudy();
  const full = isFullscreen();
  const [menu, setMenu] = useState(false);
  const bibles = modules('bible', true);
  return (
    <div className="no-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto px-1 py-0.5">
      <IconButton label={t('previous')} icon={ChevronLeft} onClick={() => stepChapter(-1)} />
      <button type="button" onClick={() => choosePassage()} className="shrink-0 rounded-full px-3 py-2 text-[17px] font-medium hover:bg-on-surface/10">
        {bookNames(lang())[a.passage.book - 1]} {a.passage.chapter}
      </button>
      <IconButton label={t('next')} icon={ChevronRight} onClick={() => stepChapter(1)} />
      <IconButton label={t('models')} icon={Box} onClick={() => openModels(a.passage)} />
      <IconButton label={tr('Contexto, temas e teologia', 'Context, themes and theology', 'Contexto, temas y teología')} icon={ScrollText} onClick={() => openVerseStudy(a.passage)} />
      <div className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menu}
          title={t('translation')}
          onClick={() => setMenu((v) => !v)}
          className="rounded-full px-3 py-2 text-[15px] font-semibold hover:bg-on-surface/10"
        >
          {a.translation}
        </button>
        {menu && (
          <>
            <button type="button" aria-label={t('close')} className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
            <ul role="menu" className="fixed left-2 right-2 top-24 z-40 max-h-[60vh] overflow-y-auto rounded-2xl bg-surface-high p-1 shadow-xl ring-1 ring-outline/40 sm:absolute sm:left-0 sm:right-auto sm:top-full sm:w-80">
              {bibles.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={m.id === a.translation}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-on-surface/5 ${m.id === a.translation ? 'font-semibold text-primary' : ''}`}
                    onClick={() => {
                      setMenu(false);
                      changeTranslation(m.id);
                    }}
                  >
                    {m.title}
                    <span className="block text-xs text-muted">
                      {m.id} · {m.language}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <IconButton label={t(study ? 'readingMode' : 'studyMode')} icon={study ? BookOpen : GraduationCap} active={study} onClick={() => set('study', !study)} />
      <IconButton label={t('fullscreen')} icon={full ? Minimize : Maximize} onClick={() => set('fullscreen', !full)} />
      {study && (
        <>
          <IconButton label={t('compare')} icon={Columns2} onClick={() => openComparison(a.passage)} />
          <IconButton label={t('tabs')} icon={PanelsTopLeft} onClick={() => openSavedPlaces('study_tabs')} />
          <IconButton label={t('bookmarks')} icon={Bookmark} onClick={() => openSavedPlaces('bookmarks')} />
        </>
      )}
    </div>
  );
}

const stepChapter = (direction: number) => step(direction);

export function changeTranslation(id: string) {
  void setPref('edition_chosen', true);
  const target = mapped(app.translation, app.passage, id) ?? app.passage;
  navigate(hasVerse(id, target) ? target : firstRefOfBook(id), { edition: id });
}

function SelectionBar({ rows, selected, clear }: { rows: VerseRow[]; selected: Set<string>; clear: () => void }) {
  const chosen = rows.filter((r) => selected.has(r.reference));
  if (chosen.length === 0) return null;
  const r = fromId(chosen[0].reference)!;
  const language = lang();
  const text = chosen.map((v) => `${refLabel(fromId(v.reference)!, language)} ${v.text}`).join('\n');
  return (
    <div className="no-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto bg-secondary-container px-1 py-0.5">
      <IconButton label={t('close')} icon={X} onClick={clear} />
      <span className="shrink-0 px-1 text-sm">
        {selected.size} {t('selected')}
      </span>
      <Action label={tr('Contexto e estudo', 'Context and study', 'Contexto y estudio')} icon={Network} onClick={() => openVerseStudy(r)} />
      <Action label={t('references')} icon={Link2} onClick={() => openCrossReferences(r)} />
      <Action label={t('commentaries')} icon={MessageSquare} onClick={() => openCommentaries(r)} />
      <Action
        label={t('copy')}
        icon={Copy}
        onClick={async () => {
          await copyText(`${text}\n${app.translation}`);
          message(t('copy'));
        }}
      />
      <Action
        label={t('note')}
        icon={NotebookPen}
        onClick={() =>
          openNewNote({
            title: refLabel(r, language),
            reference: refId(r),
            body: `[[${refId(r)}]]\n\n> ${text.replace(/\n/g, '\n> ')}\n\n`,
          })
        }
      />
      <Action
        label={t('bookmark')}
        icon={BookmarkPlus}
        onClick={async () => {
          await savePlace('bookmarks', refId(r), app.translation, refLabel(r, language));
          message(t('success'));
        }}
      />
      <Action
        label={t('tab')}
        icon={PanelsTopLeft}
        onClick={async () => {
          await savePlace('study_tabs', refId(r), app.translation, refLabel(r, language));
          message(t('success'));
        }}
      />
      {HIGHLIGHT_COLORS.map((c) => (
        <IconButton
          key={c}
          label={`${t('highlight')} ${hex(c)}`}
          icon={(props) => <Circle {...props} fill={hex(c)} color={hex(c)} />}
          onClick={() => void highlight(app.translation, selected, c)}
        />
      ))}
      <Action label={t('clearHighlight')} icon={Eraser} onClick={() => void highlight(app.translation, selected, null)} />
      <Action label={t('addCard')} icon={Brain} onClick={() => createCard(r, chosen.map((v) => v.text).join('\n'))} />
      <Action label={t('original')} icon={Languages} onClick={() => openOriginal(r)} />
      <Action label={t('contextCompare')} icon={GitCompare} onClick={() => openContextCompare(r)} />
    </div>
  );
}

function StudyActions() {
  const r = app.passage;
  return (
    <div className="no-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto px-1">
      <Action label={t('context')} icon={History} onClick={() => openTimeline(r)} />
      <Action label={t('references')} icon={Link2} onClick={() => openCrossReferences(r)} />
      <Action label={t('original')} icon={Languages} onClick={() => openOriginal(r)} />
      <Action label={t('commentaries')} icon={LibraryBig} onClick={() => openCommentaries(r)} />
    </div>
  );
}

function VerseList({ rows, colors, whole, selected, onToggle }: { rows: VerseRow[]; colors: Map<string, number>; whole: boolean; selected: Set<string>; onToggle: (id: string) => void }) {
  const parent = useRef<HTMLDivElement>(null);
  const size = fontSize();
  const pad = margins();
  const numbers = pref('numbers', true);
  const headings = pref('headings', true);
  const red = pref('red', true);
  const paragraphs = pref('paragraphs', false);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => Math.round(size * lineHeight() * 2.6 + 14),
    overscan: 8,
  });
  const initial = useRef(true);
  const passageId = refId(app.passage);

  // Posiciona no versículo atual ao abrir/trocar capítulo.
  useLayoutEffect(() => {
    const index = rows.findIndex((r) => r.reference === passageId);
    if (index > 0) virtual.scrollToIndex(index, { align: 'start' });
    else parent.current?.scrollTo({ top: 0 });
    initial.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const onScroll = useCallback(() => {
    if (initial.current) return;
    const items = virtual.getVirtualItems();
    const top = parent.current?.scrollTop ?? 0;
    const first = items.find((item) => item.end > top + 4);
    if (first) {
      const r = fromId(rows[first.index]?.reference);
      if (r) rememberPosition(r);
    }
  }, [rows, virtual]);

  const items = virtual.getVirtualItems();
  return (
    <div ref={parent} onScroll={onScroll} className="scroll-area h-full" tabIndex={-1}>
      <div className="relative mx-auto w-full max-w-reading" style={{ height: virtual.getTotalSize() + 48, paddingLeft: pad, paddingRight: pad }}>
        <div style={{ transform: `translateY(${(items[0]?.start ?? 0) + 24}px)` }}>
          {items.map((item) => {
            const row = rows[item.index];
            return (
              <div key={row.reference} data-index={item.index} ref={virtual.measureElement}>
                <Verse
                  row={row}
                  previous={rows[item.index - 1]}
                  whole={whole}
                  picked={selected.has(row.reference)}
                  color={colors.get(row.reference)}
                  onToggle={onToggle}
                  numbers={numbers}
                  headings={headings}
                  red={red}
                  paragraphs={paragraphs}
                  size={size}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ReaderPage() {
  useApp();
  const a = app;
  const whole = pref('whole_book', false);
  const { loaded, error, reload } = useChapter(a.translation, a.passage.book, a.passage.chapter, whole, a.revision);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wide, setWide] = useState(() => window.innerWidth >= 850);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 850);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => setSelected(new Set()), [loaded?.key]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    const r = fromId(id)!;
    app.passage = r;
    void recordReading(app.translation, r);
  }, []);

  const rows = loaded?.rows ?? [];
  const index = rows.findIndex((r) => r.reference === refId(a.passage));
  const study = isStudy();
  const split = study && pref('split_comments', true) && wide;

  let reading;
  if (error) reading = <ErrorBox error={error} onRetry={reload} />;
  else if (!loaded) reading = <Spinner />;
  else if (rows.length === 0) reading = <p className="p-8 text-center text-muted">{t('noContent')}</p>;
  else reading = <VerseList rows={rows} colors={loaded.colors} whole={whole} selected={selected} onToggle={toggle} />;

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      {selected.size > 0 && <SelectionBar rows={rows} selected={selected} clear={() => setSelected(new Set())} />}
      {study && <StudyActions />}
      <div className="flex min-h-0 flex-1">
        <div className={split ? 'min-w-0 flex-[3]' : 'min-w-0 flex-1'}>{reading}</div>
        {split && (
          <aside className="scroll-area min-w-0 flex-[2] border-l border-outline/40" aria-label={t('commentaries')}>
            <Suspense fallback={<Spinner />}>
              <CommentariesPanel reference={a.passage} />
            </Suspense>
          </aside>
        )}
      </div>
      {!isFullscreen() && <Progress value={rows.length ? (index + 1) / rows.length : 0} />}
    </div>
  );
}

export type { Ref };
