// SearchPage de lib/search.dart: pesquisa geral local (Bíblia, temas, documentos,
// estudos, léxico, comentários, módulos importados e anotações), com filtro por
// categoria, sugestão de grafia, detecção de referência e resultados virtualizados.
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BookMarked,
  BookOpen,
  Box,
  CloudOff,
  Download,
  FileText,
  GraduationCap,
  History,
  Languages,
  LoaderCircle,
  MapPin,
  MessageSquare,
  NotebookPen,
  ScrollText,
  Search as SearchIcon,
  SpellCheck,
  Tags,
  TriangleAlert,
  X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { app, useApp } from '../lib/app';
import { allStudies, document as loadDocument, loadModels } from '../lib/content';
import { fold, fromId, parseRef, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import {
  categoryLabel,
  highlightParts,
  hitTitle,
  releaseSearch,
  retainSearch,
  sourceLabel,
  startSearch,
  warmBible,
  type Query,
  type SearchHit,
  type SearchState,
} from '../lib/search';
import { note as loadNote } from '../lib/store';
import { Button, Chip, ErrorBox, IconButton, Progress, cx, message, useDebounced, type Icon } from '../components/ui';
import {
  openCommentaries,
  openDocument,
  openLexeme,
  openModel,
  openNote,
  openOffline,
  openStudy,
  openTopic,
  showPassage,
} from './open';

// ------------------------------------------------------------ apresentação
const ICONS: Record<string, Icon> = {
  bible: BookOpen,
  commentary: MessageSquare,
  notes: NotebookPen,
  topic: Tags,
  lexicon: Languages,
  studies: GraduationCap,
  confession: ScrollText,
  place: MapPin,
  history: History,
  model_index: Box,
  study: BookMarked,
};
const iconFor = (category: string): Icon => ICONS[category] ?? FileText;

const clamp = (lines: number) => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' });

/** Texto com os termos pesquisados destacados (nós de texto do React: nada de HTML). */
const Highlighted = memo(function Highlighted({ text, query }: { text: string; query: Query }) {
  const parts = useMemo(() => highlightParts(text, query), [text, query]);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[3px] bg-primary-container px-px text-on-primary-container">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
});

const ResultRow = memo(function ResultRow({
  hit,
  query,
  busy,
  language,
  onOpen,
}: {
  hit: SearchHit;
  query: Query;
  busy: boolean;
  language: string;
  onOpen: (hit: SearchHit) => void;
}) {
  const Icon = iconFor(hit.category);
  const source = sourceLabel(hit);
  return (
    <button
      type="button"
      data-result=""
      aria-busy={busy || undefined}
      onClick={() => onOpen(hit)}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-on-surface/5"
    >
      {busy ? (
        <LoaderCircle size={20} aria-hidden className="mt-0.5 shrink-0 animate-spin text-primary" />
      ) : (
        <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
      )}
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className="block text-[15.5px] font-medium leading-snug" style={clamp(2)}>
          <Highlighted text={hitTitle(hit, language)} query={query} />
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {[categoryLabel(hit.category), source].filter(Boolean).join(' · ')}
        </span>
        {hit.body && (
          <span className="mt-0.5 block text-sm text-muted" style={clamp(3)}>
            <Highlighted text={hit.body} query={query} />
          </span>
        )}
      </span>
    </button>
  );
});

function Notice({ icon: IconComponent, children, action }: { icon: Icon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-1 my-1.5 rounded-xl bg-secondary-container/70 px-3 py-2.5 text-sm">
      <p className="flex items-start gap-2">
        <IconComponent size={18} aria-hidden className="mt-px shrink-0" />
        <span className="min-w-0 flex-1">{children}</span>
      </p>
      {action && <div className="mt-1 flex flex-wrap gap-1 pl-6">{action}</div>}
    </div>
  );
}

type Row =
  | { kind: 'ref'; key: string; ref: Ref }
  | { kind: 'failed'; key: string; error: Error }
  | { kind: 'offline'; key: string }
  | { kind: 'bible'; key: string; missing: number; total: number; translation: string }
  | { kind: 'partial'; key: string }
  | { kind: 'errors'; key: string; errors: string[] }
  | { kind: 'empty'; key: string }
  | { kind: 'hit'; key: string; hit: SearchHit };

const FOCUSABLE = 'button[data-result], button[data-reference]';
const estimate = (row: Row | undefined) => (row?.kind === 'hit' ? 104 : row?.kind === 'ref' ? 52 : 88);

// ------------------------------------------------------------------- tela
export default function SearchPage() {
  useApp();
  const translation = app.translation;
  const language = lang();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const debounced = useDebounced(text, 250);
  // Campo vazio limpa na hora; Enter e a sugestão pesquisam sem esperar o debounce.
  const query = text.trim() === '' ? '' : submitted === text ? text : debounced;
  const [filter, setFilter] = useState('');
  const [deepFor, setDeepFor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<SearchState | null>(null);
  const [warm, setWarm] = useState<{ done: number; total: number } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const openSeq = useRef(0);
  const deep = deepFor !== null && deepFor === query;

  // O índice (worker) continua vivo entre pesquisas e enquanto a tela estiver aberta.
  useEffect(() => {
    alive.current = true;
    retainSearch();
    return () => {
      alive.current = false;
      releaseSearch();
    };
  }, []);

  // Prepara o índice bíblico da tradução atual antes da primeira consulta.
  useEffect(() => {
    setWarm(null);
    return warmBible(translation, setWarm);
  }, [translation]);

  useEffect(() => {
    if (!query.trim()) {
      setState(null);
      return;
    }
    return startSearch(query, { translation, deep }, setState);
  }, [query, translation, deep, retry]);

  const current = state && state.text === query ? state : null;
  const shown = state && query ? state : null;
  const stale = !!shown && !current;
  const hits = useMemo(() => shown?.hits ?? [], [shown]);
  const reference = useMemo(() => (query ? parseRef(query) : null), [query]);

  // Categorias presentes, na ordem em que aparecem (como o toSet() do original).
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of hits) counts.set(h.category, (counts.get(h.category) ?? 0) + 1);
    if (filter && !counts.has(filter)) counts.set(filter, 0);
    return [...counts];
  }, [hits, filter]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (reference) out.push({ kind: 'ref', key: 'ref', ref: reference });
    if (!shown) return out;
    if (shown.failed) out.push({ kind: 'failed', key: 'failed', error: shown.failed });
    if (shown.offline) out.push({ kind: 'offline', key: 'offline' });
    if (shown.bible && shown.bible.missing > 0)
      out.push({ kind: 'bible', key: 'bible', missing: shown.bible.missing, total: shown.bible.total, translation: shown.bible.translation });
    // Sem conexão, "pesquisar em todo o acervo" não ajudaria: basta o aviso offline.
    if (shown.partial && !deep && !shown.offline) out.push({ kind: 'partial', key: 'partial' });
    if (shown.errors.length > 0 && !shown.failed) out.push({ kind: 'errors', key: 'errors', errors: shown.errors });
    for (const hit of hits) if (!filter || hit.category === filter) out.push({ kind: 'hit', key: hit.key, hit });
    if (!shown.loading && !shown.failed && !stale && !out.some((r) => r.kind === 'hit')) out.push({ kind: 'empty', key: 'empty' });
    return out;
  }, [reference, shown, hits, filter, deep, stale]);

  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: (i) => estimate(rows[i]),
    overscan: 6,
    initialRect: { width: 360, height: 640 },
    getItemKey: (i) => rows[i]?.key ?? i,
  });

  // Nova consulta ou novo filtro: volta ao topo.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [current?.text, filter]);

  const choose = useCallback((value: string) => {
    setText(value);
    setSubmitted(value);
    input.current?.focus();
  }, []);

  const clear = () => {
    setText('');
    setSubmitted(null);
    setFilter('');
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setSubmitted(text);
    } else if (event.key === 'ArrowDown') {
      const first = scroller.current?.querySelector<HTMLElement>(FOCUSABLE);
      if (first) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === 'Escape' && text) {
      // Primeiro Esc limpa o campo; o seguinte fecha a folha (atalho global).
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation?.();
      clear();
    }
  };

  /** Setas para cima/baixo percorrem os resultados; acima do primeiro, volta ao campo. */
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const focusable = [...(scroller.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) input.current?.focus();
    else focusable[Math.min(next, focusable.length - 1)]?.focus();
  };

  /** Abre o resultado como o open() do original; ignora toques antigos e telas já fechadas. */
  const open = useCallback(async (hit: SearchHit) => {
    const seq = ++openSeq.current;
    const fresh = () => alive.current && seq === openSeq.current;
    const unavailable = () =>
      message(tr('Conteúdo indisponível: o módulo pode ter sido removido.', 'Content unavailable: the module may have been removed.', 'Contenido no disponible: el módulo puede haber sido eliminado.'));
    try {
      switch (hit.category) {
        case 'topic':
          openTopic(hit.id, hit.title);
          return;
        case 'bible': {
          const r = fromId(hit.id);
          if (r) showPassage(r, { sourceEdition: hit.source || undefined });
          return;
        }
        case 'lexicon':
          openLexeme(hit.id, hit.title);
          return;
        case 'commentary': {
          const r = fromId(hit.reference);
          if (r) openCommentaries(r);
          else unavailable();
          return;
        }
      }
      setOpening(hit.key);
      if (hit.category === 'notes') {
        const n = await loadNote(hit.id);
        if (!fresh()) return;
        if (n) openNote(n);
        else message(tr('Esta anotação foi excluída.', 'This note was deleted.', 'Esta nota fue eliminada.'));
        return;
      }
      if (hit.category === 'studies') {
        const study = (await allStudies()).find((s) => s.id === hit.id);
        if (!fresh()) return;
        if (study) openStudy(study, true);
        else unavailable();
        return;
      }
      const doc = await loadDocument(hit.id);
      if (!fresh()) return;
      if (!doc) {
        unavailable();
        return;
      }
      if (doc.kind === 'model_index') {
        const id = (doc.metadata as { model_id?: unknown }).model_id;
        const model = (await loadModels()).find((m) => m.id === id);
        if (!fresh()) return;
        if (model) {
          openModel(model);
          return;
        }
      }
      openDocument(doc);
    } catch (error) {
      if (fresh()) message(error instanceof Error ? error.message : String(error));
    } finally {
      if (alive.current && seq === openSeq.current) setOpening(null);
    }
  }, []);

  const progress = (shown && !stale ? shown.progress : null) ?? (warm && warm.done < warm.total ? warm : null);
  const loading = !!query && (!current || current.loading);
  const suggestion = current?.suggestion && current.suggestion !== fold(query) ? current.suggestion : null;
  const resultCount = current ? current.hits.length : 0;
  const countLabel =
    resultCount === 1
      ? tr('1 resultado', '1 result', '1 resultado')
      : tr(`${resultCount} resultados`, `${resultCount} results`, `${resultCount} resultados`);
  const items = virtual.getVirtualItems();
  const highlightQuery = shown?.query;

  const renderRow = (row: Row) => {
    switch (row.kind) {
      case 'ref':
        return (
          <button
            type="button"
            data-reference=""
            onClick={() => showPassage(row.ref)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-on-surface/5"
          >
            <BookOpen size={20} aria-hidden className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 text-[15.5px] font-medium">{refLabel(row.ref, language)}</span>
          </button>
        );
      case 'failed':
        return <ErrorBox error={row.error} onRetry={() => setRetry((n) => n + 1)} />;
      case 'offline':
        return (
          <Notice
            icon={CloudOff}
            action={
              <Button variant="text" icon={Download} className="px-3" onClick={() => openOffline()}>
                {t('offlinePacks')}
              </Button>
            }
          >
            {tr(
              'Sem conexão: parte do acervo de pesquisa não está salva neste aparelho. Os resultados abaixo vêm apenas do que já está disponível offline.',
              'Offline: part of the search collection is not saved on this device. The results below come only from what is already available offline.',
              'Sin conexión: parte del acervo de búsqueda no está guardada en este dispositivo. Los resultados vienen solo de lo que ya está disponible sin conexión.',
            )}
          </Notice>
        );
      case 'bible':
        return (
          <Notice icon={CloudOff}>
            {tr(
              `${row.missing} de ${row.total} livros de ${row.translation} não puderam ser lidos; a pesquisa bíblica está incompleta.`,
              `${row.missing} of ${row.total} books of ${row.translation} could not be read; the Bible search is incomplete.`,
              `${row.missing} de ${row.total} libros de ${row.translation} no pudieron leerse; la búsqueda bíblica está incompleta.`,
            )}
          </Notice>
        );
      case 'partial':
        return (
          <Notice
            icon={SearchIcon}
            action={
              <Button variant="text" icon={SearchIcon} className="px-3" onClick={() => setDeepFor(query)}>
                {tr('Pesquisar em todo o acervo', 'Search the whole collection', 'Buscar en todo el acervo')}
              </Button>
            }
          >
            {tr(
              'Para economizar dados, parte dos índices de pesquisa não foi baixada nesta consulta.',
              'To save data, part of the search indexes was not downloaded for this query.',
              'Para ahorrar datos, parte de los índices de búsqueda no se descargó en esta consulta.',
            )}
          </Notice>
        );
      case 'errors':
        return (
          <Notice icon={TriangleAlert}>
            {row.errors.map((e) => (
              <span key={e} className="block">
                {e}
              </span>
            ))}
          </Notice>
        );
      case 'empty':
        return <p className="px-6 py-8 text-center text-[15px] text-muted">{t('empty')}</p>;
      case 'hit':
        return <ResultRow hit={row.hit} query={highlightQuery!} busy={opening === row.hit.key} language={language} onOpen={open} />;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-1 pt-3">
        <div role="search" className="relative">
          <SearchIcon size={19} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={input}
            type="search"
            value={text}
            autoFocus
            onChange={(e) => {
              setText(e.target.value);
              setSubmitted(null);
            }}
            onKeyDown={onKeyDown}
            aria-label={t('search')}
            placeholder={tr('Palavras, temas, referências…', 'Words, topics, references…', 'Palabras, temas, referencias…')}
            enterKeyHint="search"
            autoComplete="off"
            className="w-full rounded-xl border border-outline bg-surface py-2.5 pl-10 pr-12 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {text && (
            <IconButton
              label={tr('Limpar pesquisa', 'Clear search', 'Borrar búsqueda')}
              icon={X}
              size={20}
              onClick={clear}
              className="absolute right-0.5 top-1/2 -translate-y-1/2"
            />
          )}
        </div>
        {categories.length > 0 && (
          <div role="group" aria-label={tr('Filtrar por categoria', 'Filter by category', 'Filtrar por categoría')} className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip selected={!filter} onClick={() => setFilter('')} className="shrink-0">
              {t('all')} <span className="text-muted">{hits.length}</span>
            </Chip>
            {categories.map(([category, count]) => (
              <Chip key={category} selected={filter === category} onClick={() => setFilter(category)} className="shrink-0">
                {categoryLabel(category)} <span className="text-muted">{count}</span>
              </Chip>
            ))}
          </div>
        )}
        {suggestion && (
          <Button variant="text" icon={SpellCheck} className="-ml-2 mt-1 max-w-full px-3 text-left [overflow-wrap:anywhere]" onClick={() => choose(suggestion)}>
            {t('search')}: {suggestion}
          </Button>
        )}
        <div className="mt-1 min-h-[1.25rem] text-sm text-muted" aria-hidden="true">
          {progress ? (
            <span>
              {tr('Preparando pesquisa bíblica...', 'Preparing Bible search...', 'Preparando búsqueda bíblica...')} {progress.done}/{progress.total}
            </span>
          ) : loading ? (
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle size={14} className="animate-spin" />
              {tr('Pesquisando…', 'Searching…', 'Buscando…')}
            </span>
          ) : current && current.hits.length > 0 ? (
            <span>{countLabel}</span>
          ) : null}
        </div>
        {progress && (
          <div aria-hidden="true">
            <Progress value={progress.total ? progress.done / progress.total : undefined} />
          </div>
        )}
        {/* Anúncios curtos para leitores de tela (sem repetir cada passo do progresso). */}
        <p className="sr-only" role="status" aria-live="polite">
          {progress
            ? tr('Preparando pesquisa bíblica…', 'Preparing Bible search…', 'Preparando búsqueda bíblica…')
            : loading
              ? tr('Pesquisando…', 'Searching…', 'Buscando…')
              : current
                ? current.hits.length > 0
                  ? countLabel
                  : t('empty')
                : ''}
        </p>
      </div>
      <div
        ref={scroller}
        className={cx('scroll-area min-h-0 flex-1 border-t border-outline/30 transition-opacity', stale && 'opacity-70')}
        aria-busy={loading || undefined}
      >
        {!query && (
          <p className="mx-auto max-w-3xl px-6 py-8 text-center text-[15px] text-muted">
            {tr(
              'Pesquise na Bíblia, temas, confissões, estudos, léxico, comentários e anotações, ou digite uma referência (ex.: João 3:16).',
              'Search the Bible, topics, confessions, studies, lexicon, commentaries and notes, or type a reference (e.g. John 3:16).',
              'Busque en la Biblia, temas, confesiones, estudios, léxico, comentarios y notas, o escriba una referencia (ej.: Juan 3:16).',
            )}
          </p>
        )}
        <ul
          onKeyDown={onListKeyDown}
          aria-label={tr('Resultados da pesquisa', 'Search results', 'Resultados de la búsqueda')}
          className="relative mx-auto w-full max-w-3xl px-2"
          style={{ height: virtual.getTotalSize() + 24 }}
        >
          {items.map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <li
                key={item.key}
                data-index={item.index}
                ref={virtual.measureElement}
                className="absolute left-2 right-2 top-0"
                style={{ transform: `translateY(${item.start + 4}px)` }}
              >
                {renderRow(row)}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
