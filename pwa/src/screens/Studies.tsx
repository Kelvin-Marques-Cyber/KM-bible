// Confissões e catecismos, Mesa de Estudos / Apologética presbiteriana, estudo,
// comparação de argumentos, arena, apologistas, ciência e currículos de
// religiões (lib/studies.dart, lib/religion_curricula.dart, lib/study_catalog.dart).
import {
  BookOpen,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  FlaskConical,
  Globe,
  GraduationCap,
  LibraryBig,
  MessagesSquare,
  NotebookPen,
  ReplyAll,
  Save,
  ScanSearch,
  Table2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Markdown } from '../components/Markdown';
import {
  Action,
  Async,
  Button,
  Card,
  Chip,
  Divider,
  ErrorBox,
  Feature,
  ListItem,
  Progress,
  Select,
  Small,
  Spinner,
  TextArea,
  Wrap,
  cx,
  message,
  useAsync,
  useDebounced,
} from '../components/ui';
import { app, useApp } from '../lib/app';
import {
  apologeticsDossier,
  augustineAvailable,
  augustineBook,
  augustineManifest,
  documents,
  mapped,
  type ApologeticsDossier,
  type DocumentRow,
  type Study,
} from '../lib/content';
import { fold, refLabel } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { completed, isCompleted, saveNote, setPref } from '../lib/store';
import { sortedStudies } from '../lib/studies-data';
import {
  APPROACHES,
  AUGUSTINE_BOOKS,
  AUGUSTINE_EDITION_URL,
  AUGUSTINE_INDEX_CREDITS,
  CONFESSION_TABS,
  LEVEL_KEYS,
  STAGE_NAMES,
  apologists,
  arenaNote,
  arenaProgressId,
  augustineBookTitle,
  confessionHaystack,
  docNumber,
  evaluateResponse,
  filterStudies,
  levelKey,
  referenceLabels,
  religionFamilies,
  religionTargets,
  sortByNumber,
  sortCourse,
  stageInstruction,
  studyNoteBody,
  studyRefs,
  topicTitles,
  traditionTitle,
  traditionTitles,
  validAugustineCounts,
  type Approach,
} from '../lib/studies-logic';
import { AugustineUnavailable, ExternalLink, LongMarkdown, SearchField, SourceList, VirtualRows, editionLinkLabel } from '../lib/studies-ui';
import {
  openApologists,
  openArena,
  openArgumentComparison,
  openAugustine,
  openDocument,
  openNewNote,
  openReligionCourse,
  openReligions,
  openScience,
  openStudy,
  showPassage,
} from './open';

export { topicTitles, traditionTitles };

/** Corpo dos estudos: 17 px e entrelinha 1,6, como MarkdownText do original. */
const STUDY_TEXT = 'select-text text-[17px]';

const levelLabel = (level: number) => t(levelKey(level));

// =================================================================== Confissões
export function ConfessionsPage() {
  useApp();
  const [code, setCode] = useState('WCF');
  const [search, setSearch] = useState('');
  const query = useDebounced(search, 250);
  const list = useRef<HTMLDivElement>(null);
  // Outra coleção ou outra busca: a lista recomeça do topo.
  useEffect(() => {
    if (list.current) list.current.scrollTop = 0;
  }, [code, query]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-2 pt-4">
        <p className="text-sm text-muted">
          {code === 'AUG'
            ? tr(
                'Confissões de Santo Agostinho: texto integral em português por livro e capítulo, sem resumos, disponível offline. Obra distinta dos padrões de Westminster.',
                "Saint Augustine's Confessions: full Portuguese text by book and chapter, without summaries, available offline. A work distinct from the Westminster Standards.",
                'Confesiones de San Agustín: texto íntegro en portugués por libro y capítulo, sin resúmenes, disponible sin conexión. Obra distinta de las normas de Westminster.',
              )
            : tr(
                'Escrituras como regra suprema. Westminster como padrão subordinado. Textos em português para estudo, com o original histórico disponível para conferência.',
                'Scripture as the supreme rule. Westminster as a subordinate standard. Portuguese study texts, with the historical original available for checking.',
                'Las Escrituras como regla suprema. Westminster como norma subordinada. Textos en portugués para estudio, con el original histórico disponible para consulta.',
              )}
        </p>
        <Wrap className="mt-3">
          {CONFESSION_TABS.map(([value, label]) => (
            <Chip key={value} selected={code === value} onClick={() => setCode(value)}>
              {label}
            </Chip>
          ))}
        </Wrap>
        <SearchField label={t('search')} value={search} onChange={setSearch} />
      </div>
      <div ref={list} className="scroll-area min-h-0 flex-1">
        {code === 'AUG' ? <AugustineIndex key="AUG" query={query} /> : <ConfessionList key={code} code={code} query={query} />}
      </div>
    </div>
  );
}

function ConfessionList({ code, query }: { code: string; query: string }) {
  const language = lang();
  const state = useAsync(() => documents({ moduleId: code }), [code]);
  const sorted = useMemo(() => (state.data ? sortByNumber(state.data) : []), [state.data]);
  const searching = query.trim().length > 0;
  // O texto pesquisável (sem acentos) é montado uma vez, só quando há busca.
  const haystack = useMemo(() => (searching ? sorted.map(confessionHaystack) : null), [sorted, searching]);
  const rows = useMemo(() => {
    const q = fold(query);
    if (!q || !haystack) return sorted;
    return sorted.filter((_, i) => haystack[i].includes(q));
  }, [sorted, haystack, query]);

  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return <Spinner />;
  return (
    <div className="mx-auto w-full max-w-3xl px-2 pb-6">
      <p className="sr-only" aria-live="polite">
        {searching ? `${rows.length} ${tr('resultados', 'results', 'resultados')}` : ''}
      </p>
      {rows.length === 0 ? (
        <p className="p-4 text-[15px]">{t('empty')}</p>
      ) : (
        <VirtualRows
          rows={rows}
          estimate={() => 76}
          rowKey={(d) => d.id}
          render={(d: DocumentRow) => {
            const refs = referenceLabels(d, language);
            const question = code !== 'WCF' && d.pt?.title ? d.pt.title : '';
            return (
              <ListItem
                title={code === 'WCF' ? d.title : `${tr('Pergunta', 'Question', 'Pregunta')} ${docNumber(d)}`}
                subtitle={[question, refs].filter(Boolean).join('\n') || undefined}
                trailing="chevron"
                onClick={() => openDocument(d)}
              />
            );
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------- Agostinho (índice)
type IndexRow = { kind: 'book'; book: number; matches: number } | { kind: 'chapter'; book: number; chapter: number };
type TitleState = string[] | 'loading' | 'error';

function openAugustineAt(book: number, chapter: number) {
  // Como o original: grava a posição (base 0) antes de abrir o leitor.
  void setPref('agostinho_livro', book, false);
  void setPref('agostinho_capitulo', chapter, false);
  openAugustine({ book, chapter });
}

/**
 * Títulos dos capítulos, lidos de cada livro (≈ 60 KB) só quando uma linha
 * desse livro chega à tela; pedidos repetidos reaproveitam o mesmo carregamento.
 */
function useChapterTitles(available: boolean) {
  const [titles, setTitles] = useState<Record<number, TitleState>>({});
  const pending = useRef(new Map<number, Promise<void>>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const request = useCallback(
    (b: number): Promise<void> => {
      if (!available) return Promise.resolve();
      const existing = pending.current.get(b);
      if (existing) return existing;
      setTitles((current) => ({ ...current, [b]: 'loading' }));
      const promise = augustineBook(b).then(
        (data) => {
          if (alive.current) setTitles((current) => ({ ...current, [b]: (data?.chapters ?? []).map((ch) => String(ch.title ?? '').trim()) }));
        },
        () => {
          // Uma nova linha desse livro na tela tenta outra vez (sem repetição automática em laço).
          pending.current.delete(b);
          if (alive.current) setTitles((current) => ({ ...current, [b]: 'error' }));
        },
      );
      pending.current.set(b, promise);
      return promise;
    },
    [available],
  );
  return { titles, request };
}

function AugustineChapterRow({ book, chapter, title, request }: { book: number; chapter: number; title: string; request: (b: number) => Promise<void> }) {
  useEffect(() => {
    void request(book);
  }, [book, request]);
  return (
    <ListItem
      leading={BookOpenText}
      title={`${tr('Livro', 'Book', 'Libro')} ${book} · ${tr('Capítulo', 'Chapter', 'Capítulo')} ${chapter}`}
      subtitle={title || `${augustineBookTitle(book)} · ${tr('Ler as palavras de Agostinho', "Read Augustine's own words", 'Leer las palabras de Agustín')}`}
      trailing="chevron"
      onClick={() => openAugustineAt(book - 1, chapter - 1)}
    />
  );
}

function AugustineIndex({ query }: { query: string }) {
  const available = augustineAvailable();
  const manifest = useAsync(() => (available ? augustineManifest() : Promise.resolve(null)), [available]);
  const [book, setBook] = useState(0); // Zero = todos os livros.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const { titles, request } = useChapterTitles(available);
  const q = fold(query);

  const counts = useMemo(() => {
    const meta = manifest.data;
    return meta && validAugustineCounts(meta.chapterCounts, meta.chapterCount) ? meta.chapterCounts : AUGUSTINE_BOOKS.map((b) => b.chapterCount);
  }, [manifest.data]);

  const chapterTitle = useCallback(
    (b: number, c: number) => {
      const list = titles[b];
      return Array.isArray(list) ? list[c - 1] ?? '' : '';
    },
    [titles],
  );

  const rows = useMemo<IndexRow[]>(() => {
    const out: IndexRow[] = [];
    for (let b = 1; b <= counts.length; b++) {
      if (book !== 0 && b !== book) continue;
      const chapters: IndexRow[] = [];
      for (let c = 1; c <= counts[b - 1]; c++) {
        // Mesmo texto pesquisável do original + o título do capítulo, quando já lido.
        if (!q || fold(`Livro ${b} ${augustineBookTitle(b)} Capítulo ${c} ${chapterTitle(b, c)}`).includes(q)) {
          chapters.push({ kind: 'chapter', book: b, chapter: c });
        }
      }
      if (book !== 0) out.push(...chapters);
      else if (chapters.length > 0) {
        out.push({ kind: 'book', book: b, matches: chapters.length });
        if (q || expanded.has(b)) out.push(...chapters);
      }
    }
    return out;
  }, [counts, book, expanded, q, chapterTitle]);

  // Com uma busca, os títulos dos capítulos também entram: lidos um livro por vez.
  useEffect(() => {
    if (!q || !available || manifest.data === undefined) return;
    let cancelled = false;
    void (async () => {
      for (let b = 1; b <= counts.length && !cancelled; b++) {
        if (book !== 0 && b !== book) continue;
        await request(b);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, available, manifest.data, counts, book, request]);

  const toggle = (b: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(b)) next.add(b);
      return next;
    });

  if (!available) return <AugustineUnavailable />;
  if (manifest.error) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p role="alert" className="select-text text-[15px]">
          {tr('Não foi possível carregar o índice de Agostinho: ', 'Could not load the Augustine index: ', 'No se pudo cargar el índice de Agustín: ')}
          {manifest.error instanceof Error ? manifest.error.message : String(manifest.error)}
        </p>
        <Button variant="text" className="mt-2" onClick={manifest.reload}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  if (manifest.data === undefined) return <Spinner />;
  const total = counts.reduce((a, b) => a + b, 0);
  // Busca ativa e algum livro do recorte ainda sem títulos (nem lidos, nem com falha).
  const searchingTitles = !!q && counts.some((_, i) => (book === 0 || book === i + 1) && !Array.isArray(titles[i + 1]) && titles[i + 1] !== 'error');
  const chapterMatches = rows.reduce((n, r) => n + (r.kind === 'chapter' ? 1 : 0), 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6">
      <p className="text-[15px]">
        {tr(
          '13 livros e 278 capítulos em português integral, sem resumos e disponíveis offline. Selecione um capítulo para ler aqui no aplicativo.',
          '13 books and 278 chapters in full Portuguese, without summaries and available offline. Select a chapter to read it here in the app.',
          '13 libros y 278 capítulos en portugués íntegro, sin resúmenes y disponibles sin conexión. Seleccione un capítulo para leerlo aquí en la aplicación.',
        )}
      </p>
      <Select
        className="mt-3"
        label={tr('Selecionar livro de Agostinho', 'Select a book of Augustine', 'Seleccionar libro de Agustín')}
        value={String(book)}
        onChange={(e) => setBook(Number(e.target.value))}
        options={[
          { value: '0', label: tr(`Todos os 13 livros · ${total} capítulos`, `All 13 books · ${total} chapters`, `Los 13 libros · ${total} capítulos`) },
          ...counts.map((_, i) => ({ value: String(i + 1), label: `${tr('Livro', 'Book', 'Libro')} ${i + 1} · ${augustineBookTitle(i + 1)}` })),
        ]}
      />
      <ExternalLink href={AUGUSTINE_EDITION_URL} className="-ml-3 mt-2">
        {editionLinkLabel()}
      </ExternalLink>
      <p className="sr-only" aria-live="polite">
        {q ? `${chapterMatches} ${tr('capítulos', 'chapters', 'capítulos')}` : ''}
      </p>
      {searchingTitles && (
        <div role="status" className="mt-2">
          <Progress />
          <Small className="mt-1">{tr('Procurando também nos títulos dos capítulos…', 'Also searching chapter titles…', 'Buscando también en los títulos de los capítulos…')}</Small>
        </div>
      )}
      {rows.length === 0 ? (
        searchingTitles ? null : <p className="p-4 text-[15px]">{tr('Nenhum capítulo encontrado.', 'No chapter found.', 'Ningún capítulo encontrado.')}</p>
      ) : (
        <VirtualRows
          className="mt-2"
          label={tr('Capítulos das Confissões', 'Chapters of the Confessions', 'Capítulos de las Confesiones')}
          rows={rows}
          estimate={(r) => (r.kind === 'book' ? 64 : 72)}
          rowKey={(r) => (r.kind === 'book' ? `b${r.book}` : `c${r.book}:${r.chapter}`)}
          render={(r: IndexRow) =>
            r.kind === 'book' ? (
              <button
                type="button"
                aria-expanded={!!q || expanded.has(r.book)}
                disabled={!!q}
                onClick={() => toggle(r.book)}
                className="mt-1 flex min-h-[56px] w-full items-center gap-3 rounded-xl bg-surface-low px-3 py-2.5 text-left ring-1 ring-outline/30 transition hover:bg-surface-high disabled:cursor-default"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold leading-snug">
                    {tr('Livro', 'Book', 'Libro')} {r.book} · {augustineBookTitle(r.book)}
                  </span>
                  <span className="block text-sm text-muted">
                    {r.matches} {tr('capítulos', 'chapters', 'capítulos')}
                  </span>
                </span>
                {!q && <ChevronDown size={20} aria-hidden className={cx('shrink-0 text-muted transition-transform', expanded.has(r.book) && 'rotate-180')} />}
              </button>
            ) : (
              <AugustineChapterRow book={r.book} chapter={r.chapter} title={chapterTitle(r.book, r.chapter)} request={request} />
            )
          }
        />
      )}
      <Small className="mt-4 select-text">{AUGUSTINE_INDEX_CREDITS}</Small>
    </div>
  );
}

// ================================================================ Mesa de estudos
export function StudiesBrowser({ apologetic }: { apologetic: boolean }) {
  useApp();
  const [level, setLevel] = useState<number | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const state = useAsync(sortedStudies, []);
  const rows = useMemo(() => (state.data ? filterStudies(state.data, { topic, target, level }) : []), [state.data, topic, target, level]);

  return (
    <div className="mx-auto max-w-3xl p-5">
      <p className="font-reading text-[23px] leading-snug">
        {apologetic
          ? 'Estai sempre preparados para responder — 1 Pedro 3:15'
          : tr(
              'Conhecer cada posição por suas fontes e seus próprios argumentos.',
              'Know each position by its sources and its own arguments.',
              'Conocer cada posición por sus fuentes y sus propios argumentos.',
            )}
      </p>
      <Wrap className="mt-4 gap-1">
        <Action label={tr('Religiões por categoria', 'Religions by category', 'Religiones por categoría')} icon={Globe} onClick={() => openReligions(apologetic)} />
        <Action label={tr('Ciência e ateísmo', 'Science and atheism', 'Ciencia y ateísmo')} icon={FlaskConical} onClick={openScience} />
        <Action label={t('apologists')} icon={LibraryBig} onClick={openApologists} />
        <Action label={t('arena')} icon={MessagesSquare} onClick={openArena} />
      </Wrap>
      <Wrap className="mt-3">
        <Chip selected={level === null} onClick={() => setLevel(null)}>
          {t('all')}
        </Chip>
        {LEVEL_KEYS.map((key, i) => (
          <Chip key={key} selected={level === i + 1} onClick={() => setLevel(i + 1)}>
            {t(key)}
          </Chip>
        ))}
      </Wrap>
      <Select
        className="mt-4"
        label={t('topic')}
        value={topic ?? ''}
        onChange={(e) => setTopic(e.target.value || null)}
        options={[{ value: '', label: t('all') }, ...Object.entries(topicTitles).map(([value, label]) => ({ value, label }))]}
      />
      <Select
        className="mt-3.5"
        label={tr('Tradição / perspectiva', 'Tradition / perspective', 'Tradición / perspectiva')}
        value={target ?? ''}
        onChange={(e) => setTarget(e.target.value || null)}
        options={[{ value: '', label: t('all') }, ...Object.entries(traditionTitles).map(([value, label]) => ({ value, label }))]}
      />
      <p className="sr-only" aria-live="polite">
        {state.data ? `${rows.length} ${tr('estudos', 'studies', 'estudios')}` : ''}
      </p>
      <div className="mt-5">
        <Async state={state}>
          {() =>
            rows.length === 0 ? (
              <p className="text-[15px]">{t('noStudy')}</p>
            ) : (
              <VirtualRows
                rows={rows}
                estimate={() => 92}
                rowKey={(s) => s.id}
                render={(s: Study) => (
                  <Card className="mb-2">
                    <ListItem
                      leading={isCompleted(s.id) ? CircleCheck : GraduationCap}
                      title={s.title}
                      subtitle={`${levelLabel(s.level)} · ${traditionTitle(s.target)}`}
                      trailing="chevron"
                      onClick={() => openStudy(s, apologetic)}
                    />
                  </Card>
                )}
              />
            )
          }
        </Async>
      </div>
    </div>
  );
}

// ======================================================================= Estudo
type Dossier = { status: 'idle' | 'loading' | 'missing' | 'error' } | { status: 'ready'; data: ApologeticsDossier };

/**
 * Dossiê da tradição (panorama impessoal + argumentação presbiteriana), só quando
 * pedido. Trocar de modo durante o carregamento não deixa a tela presa: o pedido
 * é refeito (do cache em memória) na próxima vez em que for necessário.
 */
function useDossier(target: string, wanted: boolean) {
  const [state, setState] = useState<Dossier>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const settled = state.status === 'ready' || state.status === 'missing';
  useEffect(() => {
    if (!wanted || settled) return;
    let alive = true;
    setState({ status: 'loading' });
    apologeticsDossier(target).then(
      (data) => alive && setState(data ? { status: 'ready', data } : { status: 'missing' }),
      () => alive && setState({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, wanted, attempt]);
  return { state, retry: () => setAttempt((n) => n + 1) };
}

export function StudyPage({ study, apologetic: initialMode }: { study: Study; apologetic: boolean }) {
  useApp();
  const language = lang();
  const [apologetic, setApologetic] = useState(initialMode);
  const [strongest, setStrongest] = useState(false);
  const [rejoinder, setRejoinder] = useState(false);
  const [extended, setExtended] = useState(false);
  const dossier = useDossier(study.target, !apologetic || extended);
  const refs = useMemo(() => studyRefs(study), [study]);
  const modeLabel = apologetic ? t('apologetics') : t('impersonal');
  const done = isCompleted(study.id);
  const d = dossier.state;

  return (
    <article className="mx-auto max-w-reading p-5">
      <Wrap>
        <Chip selected={apologetic} onClick={() => setApologetic(true)}>
          {t('apologetics')}
        </Chip>
        <Chip selected={!apologetic} onClick={() => setApologetic(false)}>
          {t('impersonal')}
        </Chip>
      </Wrap>
      <h3 className="mt-5 text-[17px] font-semibold leading-snug">
        {modeLabel} · {traditionTitle(study.target)}
      </h3>
      <div className="mt-2.5">
        {apologetic ? (
          <Markdown text={study.exposition} className={STUDY_TEXT} />
        ) : d.status === 'ready' && d.data.impersonal.trim() ? (
          <LongMarkdown text={d.data.impersonal} className={STUDY_TEXT} />
        ) : d.status === 'missing' || d.status === 'error' || d.status === 'ready' ? (
          <>
            <p role="status" className="rounded-xl bg-secondary-container p-3 text-[15px]">
              {tr(
                'Panorama aprofundado indisponível nesta versão. Atualize o aplicativo para consultar o acervo completo.',
                'In-depth overview unavailable in this version. Update the app to access the full collection.',
                'Panorama profundo no disponible en esta versión. Actualice la aplicación para consultar el acervo completo.',
              )}
            </p>
            {d.status === 'error' && (
              <Button variant="text" className="mt-1" onClick={dossier.retry}>
                {t('retry')}
              </Button>
            )}
            <div className="mt-3">
              <Markdown text={study.exposition} className={STUDY_TEXT} />
            </div>
          </>
        ) : (
          <Spinner />
        )}
      </div>

      {apologetic && (
        <>
          <Divider className="my-7" />
          <h3 className="text-[17px] font-semibold leading-snug">{t('apologetics')}</h3>
          <div className="mt-2.5">
            <Markdown text={study.response} className={STUDY_TEXT} />
          </div>
          <Button variant="outlined" icon={extended ? ChevronUp : BookOpenText} className="mt-5" aria-expanded={extended} onClick={() => setExtended((v) => !v)}>
            {extended
              ? tr('Recolher fundamentação presbiteriana', 'Collapse Presbyterian grounding', 'Contraer fundamentación presbiteriana')
              : tr('Ler argumentação presbiteriana aprofundada', 'Read in-depth Presbyterian argument', 'Leer argumentación presbiteriana profunda')}
          </Button>
          {extended && (
            <div className="pb-4 pt-3" aria-busy={d.status === 'loading'}>
              {d.status === 'ready' && d.data.reformed.trim() ? (
                <LongMarkdown text={d.data.reformed} className={STUDY_TEXT} />
              ) : d.status === 'missing' || d.status === 'error' || d.status === 'ready' ? (
                <p role="status" className="p-2.5 text-[15px]">
                  {tr(
                    'Fundamentação estendida não disponível. Atualize o aplicativo.',
                    'Extended grounding not available. Update the app.',
                    'Fundamentación extendida no disponible. Actualice la aplicación.',
                  )}
                  {d.status === 'error' && (
                    <Button variant="text" className="ml-1" onClick={dossier.retry}>
                      {t('retry')}
                    </Button>
                  )}
                </p>
              ) : (
                <div role="status" aria-label={t('loading')} className="py-2">
                  <Progress />
                </div>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-col items-start gap-2">
            <Button variant="outlined" icon={ScanSearch} aria-expanded={strongest} onClick={() => setStrongest((v) => !v)}>
              {t('strongest')}
            </Button>
            {strongest && <Markdown text={study.strongest} className={cx(STUDY_TEXT, 'w-full py-1')} />}
            <Button variant="outlined" icon={ReplyAll} aria-expanded={rejoinder} onClick={() => setRejoinder((v) => !v)}>
              {t('rejoinder')}
            </Button>
            {rejoinder && <Markdown text={study.rejoinder} className={cx(STUDY_TEXT, 'w-full py-1')} />}
          </div>
          <Button variant="text" icon={Table2} className="-ml-3 mt-4" onClick={() => openArgumentComparison(study)}>
            {t('argumentCompare')}
          </Button>
        </>
      )}

      {refs.length > 0 && (
        <Wrap className="mt-4">
          {refs.map((r) => (
            <Chip key={`${r.book}:${r.chapter}:${r.verse}`} icon={BookOpen} onClick={() => showPassage(mapped('BLN4', r, app.translation) ?? r)}>
              {refLabel(r, language)}
            </Chip>
          ))}
        </Wrap>
      )}
      <SourceList sources={study.sources} />
      <label className="mt-4 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-1 py-2">
        <input type="checkbox" className="h-5 w-5 shrink-0" checked={done} onChange={(e) => void completed(study.id, e.target.checked)} />
        <span className="text-[15.5px]">{t('completed')}</span>
      </label>
      <Action
        label={t('note')}
        icon={NotebookPen}
        onClick={() => void openNewNote({ title: study.title, body: studyNoteBody(study.id), reference: study.id })}
      />
    </article>
  );
}

// ======================================================== Comparar argumentos
export function ArgumentComparison({ study }: { study: Study }) {
  useApp();
  const left = traditionTitle(study.target);
  const right = t('apologetics');
  const rows: [string, string, string, string][] = [
    [study.exposition, study.response, t('impersonal'), t('apologetics')],
    [study.strongest, study.rejoinder, tr('Objeção mais forte', 'Strongest objection', 'Objeción más fuerte'), tr('Réplica', 'Rejoinder', 'Réplica')],
  ];
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-5">
      <div role="table" aria-label={t('argumentCompare')} className="overflow-hidden rounded-2xl ring-1 ring-outline/60">
        <div role="rowgroup" className="hidden sm:block">
          <div role="row" className="grid grid-cols-2 border-b border-outline/60 bg-surface-low">
            <div role="columnheader" className="p-3 font-semibold">
              {left}
            </div>
            <div role="columnheader" className="border-l border-outline/60 p-3 font-semibold">
              {right}
            </div>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map(([a, b, captionA, captionB], i) => (
            <div key={i} role="row" className={cx('grid grid-cols-1 sm:grid-cols-2', i > 0 && 'border-t border-outline/60')}>
              <div role="cell" className="min-w-0 p-3">
                <p className="mb-1.5 text-sm font-semibold text-muted sm:hidden">
                  {left} · {captionA}
                </p>
                <Markdown text={a} className="select-text text-[16px]" />
              </div>
              <div role="cell" className="min-w-0 border-t border-outline/60 p-3 sm:border-l sm:border-t-0">
                <p className="mb-1.5 text-sm font-semibold text-muted sm:hidden">
                  {right} · {captionB}
                </p>
                <Markdown text={b} className="select-text text-[16px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <SourceList sources={study.sources} />
    </div>
  );
}

// ======================================================================== Arena
export function ArenaPage() {
  useApp();
  const state = useAsync(sortedStudies, []);
  const [studyId, setStudyId] = useState<string | null>(null);
  const [approach, setApproach] = useState<Approach>('presuppositional');
  const [stage, setStage] = useState(1);
  const [response, setResponse] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <Async state={state}>
      {(all) => {
        if (all.length === 0) return <p className="p-6">{t('noStudy')}</p>;
        const s = all.find((r) => r.id === studyId) ?? all[0];
        const save = async () => {
          try {
            await saveNote(arenaNote(s, t(approach), stage, response, feedback));
            await completed(arenaProgressId(s.id, stage), true);
            message(t('success'));
          } catch (error) {
            message(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
          }
        };
        return (
          <div className="mx-auto max-w-3xl p-5">
            <Select
              label={tr('Objeção a ser estudada', 'Objection to study', 'Objeción a estudiar')}
              value={s.id}
              onChange={(e) => setStudyId(e.target.value)}
              options={all.map((r) => ({ value: r.id, label: r.title }))}
            />
            <Select
              className="mt-4"
              label={t('approach')}
              value={approach}
              onChange={(e) => setApproach(e.target.value as Approach)}
              options={APPROACHES.map((value) => ({ value, label: t(value) }))}
            />
            <Wrap className="mt-4">
              {STAGE_NAMES.map((name, i) => (
                <Chip key={name} selected={stage === i + 1} onClick={() => setStage(i + 1)}>
                  {i + 1} · {name}
                </Chip>
              ))}
            </Wrap>
            <p className="mt-3 text-[15.5px]">{stageInstruction(stage)}</p>
            <TextArea className="mt-4" label={t('response')} rows={10} value={response} onChange={(e) => setResponse(e.target.value)} />
            <Button className="mt-4" onClick={() => setFeedback(evaluateResponse(response, stage))}>
              {t('feedback')}
            </Button>
            <div aria-live="polite">
              {feedback !== null && <p className="select-text whitespace-pre-line py-5 text-[15.5px] leading-relaxed">{feedback}</p>}
            </div>
            <Wrap className="mt-3">
              <Button variant="outlined" icon={Table2} onClick={() => openStudy(s, true)}>
                {t('argumentCompare')}
              </Button>
              <Action label={t('save')} icon={Save} onClick={() => void save()} />
            </Wrap>
          </div>
        );
      }}
    </Async>
  );
}

// ================================================================ Apologistas
export function ApologistsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-5">
      {apologists.map((a) => (
        <Card key={a.name} className="p-[18px]">
          <h3 className="text-[21px] font-semibold leading-snug">{a.name}</h3>
          <p className="text-[15px] text-muted">{a.dates}</p>
          <p className="mt-3 select-text text-[15.5px] leading-relaxed">{a.text}</p>
          <p className="mt-3 select-text text-[15px] italic">{a.works}</p>
          <SourceList sources={[a.source]} className="mt-3" />
          <p className="mt-1 text-xs text-muted">
            {tr(
              'Resumo próprio e bibliografia. Obras protegidas não são reproduzidas neste catálogo.',
              'Own summary and bibliography. Protected works are not reproduced in this catalogue.',
              'Resumen propio y bibliografía. Las obras protegidas no se reproducen en este catálogo.',
            )}
          </p>
        </Card>
      ))}
    </div>
  );
}

// =================================================================== Ciência
export function SciencePage() {
  useApp();
  const state = useAsync(sortedStudies, []);
  return (
    <div className="mx-auto max-w-3xl p-5">
      <h3 className="text-2xl leading-snug">{tr('Ciência, filosofia e fé', 'Science, philosophy and faith', 'Ciencia, filosofía y fe')}</h3>
      <p className="mt-3 text-[15.5px] leading-relaxed">
        {tr(
          'O laboratório examina dados científicos e argumentos sobre Deus, com a perspectiva reformada identificada. Cada estudo separa observações, inferências, objeções e reflexão. O ateísmo e o agnosticismo são tratados pelas posições que efetivamente sustentam.',
          'The laboratory examines scientific data and arguments about God, with the Reformed perspective identified. Each study separates observations, inferences, objections and reflection. Atheism and agnosticism are treated by the positions they actually hold.',
          'El laboratorio examina datos científicos y argumentos sobre Dios, con la perspectiva reformada identificada. Cada estudio separa observaciones, inferencias, objeciones y reflexión. El ateísmo y el agnosticismo se tratan por las posiciones que efectivamente sostienen.',
        )}
      </p>
      <div className="mt-4">
        <Async state={state}>
          {(all) => {
            const rows = filterStudies(all, { target: 'atheism', topic: 'science' });
            return rows.length === 0 ? (
              <p>{t('noStudy')}</p>
            ) : (
              <>
                {rows.map((row) => (
                  <Feature
                    key={row.id}
                    title={row.title}
                    subtitle={tr('Estudo com fontes · argumento e objeção mais forte', 'Study with sources · argument and strongest objection', 'Estudio con fuentes · argumento y objeción más fuerte')}
                    icon={FlaskConical}
                    onClick={() => openStudy(row, true)}
                  />
                ))}
              </>
            );
          }}
        </Async>
      </div>
    </div>
  );
}

// ======================================================= Religiões e currículos
export function ReligionCurriculaPage({ apologetic = false }: { apologetic?: boolean }) {
  useApp();
  const state = useAsync(sortedStudies, []);
  const [family, setFamily] = useState('');
  const [search, setSearch] = useState('');
  const filter = useDebounced(search, 250);
  const targets = useMemo(() => (state.data ? religionTargets(state.data, family, filter) : []), [state.data, family, filter]);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h3 className="text-[23px] leading-snug">{tr('Religiões e cosmovisões', 'Religions and worldviews', 'Religiones y cosmovisiones')}</h3>
      <p className="mt-1 text-[15px]">
        {tr(
          'Introdução, textos, realidade última, ser humano, salvação, culto, ética e vida futura. As fontes e a cobertura de cada tradição ficam identificadas.',
          'Introduction, texts, ultimate reality, the human being, salvation, worship, ethics and the afterlife. The sources and coverage of each tradition are identified.',
          'Introducción, textos, realidad última, ser humano, salvación, culto, ética y vida futura. Se identifican las fuentes y la cobertura de cada tradición.',
        )}
      </p>
      <Select
        className="mt-3"
        label={t('category')}
        value={family}
        onChange={(e) => setFamily(e.target.value)}
        options={[
          { value: '', label: tr('Todas as categorias', 'All categories', 'Todas las categorías') },
          ...Object.keys(religionFamilies).map((f) => ({ value: f, label: f })),
        ]}
      />
      <SearchField label={tr('Procurar religião ou tradição', 'Search religion or tradition', 'Buscar religión o tradición')} value={search} onChange={setSearch} />
      <p className="sr-only" aria-live="polite">
        {state.data ? `${targets.length} ${tr('tradições', 'traditions', 'tradiciones')}` : ''}
      </p>
      <div className="mt-4">
        <Async state={state}>
          {() =>
            targets.length === 0 ? (
              <p className="p-2 text-[15px]">{t('empty')}</p>
            ) : (
              <ul className="space-y-2">
                {targets.map((entry) => (
                  <li key={entry.target}>
                    <Card>
                      <ListItem
                        leading={Globe}
                        title={entry.title}
                        subtitle={tr(
                          `${entry.count} estudos instalados · fontes e comparação`,
                          `${entry.count} installed studies · sources and comparison`,
                          `${entry.count} estudios instalados · fuentes y comparación`,
                        )}
                        trailing="chevron"
                        onClick={() => openReligionCourse(entry.target, entry.title, apologetic)}
                      />
                    </Card>
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      </div>
    </div>
  );
}

export function ReligionCoursePage({ target, apologetic = false }: { target: string; apologetic?: boolean }) {
  useApp();
  const state = useAsync(sortedStudies, []);
  const rows = useMemo(() => (state.data ? sortCourse(filterStudies(state.data, { target })) : []), [state.data, target]);
  return (
    <div className="mx-auto max-w-3xl p-[18px]">
      <h3 className="text-[21px] font-semibold leading-snug">{traditionTitles[target] ?? target}</h3>
      <p className="mt-1 text-[15px]">
        {tr(
          'Acervo progressivo: cada assunto oferece exposição, referências, resposta reformada e exame de objeções. A cobertura é limitada aos estudos registrados, com revisão especializada pendente.',
          'Progressive collection: each subject offers exposition, references, a Reformed response and examination of objections. Coverage is limited to the registered studies, with specialist review pending.',
          'Acervo progresivo: cada asunto ofrece exposición, referencias, respuesta reformada y examen de objeciones. La cobertura se limita a los estudios registrados, con revisión especializada pendiente.',
        )}
      </p>
      <div className="mt-3.5">
        <Async state={state}>
          {() =>
            rows.length === 0 ? (
              <p>{t('noStudy')}</p>
            ) : (
              <ul>
                {rows.map((row) => (
                  <li key={row.id}>
                    <ListItem
                      leading={isCompleted(row.id) ? CircleCheck : BookOpen}
                      title={row.title}
                      subtitle={tr(`Nível ${row.level} · exposição e apologética`, `Level ${row.level} · exposition and apologetics`, `Nivel ${row.level} · exposición y apologética`)}
                      trailing={<ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />}
                      onClick={() => openStudy(row, apologetic)}
                    />
                  </li>
                ))}
              </ul>
            )
          }
        </Async>
      </div>
    </div>
  );
}
