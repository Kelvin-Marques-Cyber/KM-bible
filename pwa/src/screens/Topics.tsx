// BibleTopicsPage e TopicPage (lib/bible_topics.dart): índice temático de
// R. A. Torrey em português, por passagem ou geral, com o original histórico.
import { useVirtualizer } from '@tanstack/react-virtual';
import { Languages, Search, Tag } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/app';
import { filterTopics, topic, topicsAt, type Topic, type TopicDetail } from '../lib/content';
import { fromId, refId, refLabel, type Ref } from '../lib/domain';
import { lang, tr } from '../lib/i18n';
import { stripTags } from '../lib/studycontext';
import { LongStudyText } from '../lib/studycontext-text';
import { Disclosure, InlineError, RefChips } from '../lib/studycontext-ui';
import { Async, Button, Chip, ListItem, Progress, Small, Spinner, Wrap, useAsync, useDebounced } from '../components/ui';
import { openLongText, openTopic } from './open';

const PAGE = 80;

export function BibleTopicsPage({ reference }: { reference?: Ref }) {
  useApp();
  const language = lang();
  const searchId = useId();
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const query = useDebounced(search, 250);
  const scoped = reference !== undefined && !all;
  const key = reference ? refId(reference) : '';
  // Como no original: com uma passagem escolhida, a busca não se aplica.
  const state = useAsync<Topic[]>(
    () => (scoped && reference ? topicsAt(reference, limit) : filterTopics(query, limit)),
    [scoped, key, scoped ? '' : query, limit],
  );
  const rows = state.data ?? [];
  const settled = state.data !== undefined && !state.loading;

  const parent = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 76,
    overscan: 8,
    initialRect: { width: 360, height: 640 },
  });
  const items = virtual.getVirtualItems();
  // Nova busca ou novo escopo: volta ao início da lista.
  useEffect(() => {
    if (parent.current) parent.current.scrollTop = 0;
  }, [query, scoped]);

  // Rodapé da lista (fora das linhas virtuais, sempre alcançável no fim da rolagem).
  let footer = null;
  if (settled && rows.length >= limit) {
    footer = (
      <div className="flex justify-center py-3">
        <Button variant="text" onClick={() => setLimit((n) => n + PAGE)}>
          {tr('Mostrar mais temas', 'Show more topics', 'Mostrar más temas')}
        </Button>
      </div>
    );
  } else if (settled && rows.length === 0) {
    footer = (
      <p className="p-6 text-[15px]">
        {tr(
          'Não há tema editorial indexado para esta busca. A pesquisa bíblica continua disponível.',
          'No editorial topic is indexed for this search. Bible search remains available.',
          'No hay tema editorial indexado para esta búsqueda. La búsqueda bíblica sigue disponible.',
        )}
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-2 pt-4">
        <h3 className="text-[22px] leading-snug">{tr('Temas bíblicos', 'Bible topics', 'Temas bíblicos')}</h3>
        <p className="mt-1 text-[15px] text-muted">
          {tr(
            'Índice histórico de R. A. Torrey em português, com ligações editoriais às passagens. Leia sempre os textos no contexto.',
            "R. A. Torrey's historical index in Portuguese, with editorial links to passages. Always read the texts in context.",
            'Índice histórico de R. A. Torrey en portugués, con enlaces editoriales a los pasajes. Lea siempre los textos en su contexto.',
          )}
        </p>
        {reference && (
          <Wrap className="mt-3">
            <Chip selected={scoped} onClick={() => setAll(false)}>
              {refLabel(reference, language)}
            </Chip>
            <Chip selected={all} onClick={() => setAll(true)}>
              {tr('Todos os temas', 'All topics', 'Todos los temas')}
            </Chip>
          </Wrap>
        )}
        {!scoped && (
          <div className="mt-3">
            <label htmlFor={searchId} className="mb-1 block text-sm text-muted">
              {tr('Pesquisar tema', 'Search topic', 'Buscar tema')}
            </label>
            <span className="relative block">
              <Search size={19} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id={searchId}
                type="search"
                value={search}
                placeholder={tr('Amor, graça, fé, aliança…', 'Love, grace, faith, covenant…', 'Amor, gracia, fe, alianza…')}
                onChange={(e) => setSearch(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-outline bg-surface py-2.5 pl-10 pr-3 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </span>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {settled ? `${rows.length} ${tr('temas', 'topics', 'temas')}` : ''}
        </p>
      </div>
      <div className="h-1 shrink-0">{state.loading && <Progress />}</div>
      {state.error ? (
        <div className="mx-auto w-full max-w-3xl px-4">
          <InlineError error={state.error} onRetry={state.reload} />
        </div>
      ) : state.data === undefined ? (
        <Spinner />
      ) : (
        <div ref={parent} className="scroll-area min-h-0 flex-1">
          <ul className="relative mx-auto w-full max-w-3xl" style={{ height: virtual.getTotalSize() }}>
            {items.map((item) => {
              const row = rows[item.index];
              return (
                <li
                  key={row.id}
                  data-index={item.index}
                  ref={virtual.measureElement}
                  className="absolute left-0 right-0 top-0 px-2"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <ListItem
                    leading={Tag}
                    title={row.title}
                    subtitle={tr('Passagens, aspectos do tema e fonte histórica', 'Passages, aspects of the topic and historical source', 'Pasajes, aspectos del tema y fuente histórica')}
                    trailing="chevron"
                    onClick={() => openTopic(row.id, row.title)}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mx-auto w-full max-w-3xl pb-4">{footer}</div>
        </div>
      )}
    </div>
  );
}

function TopicView({ row }: { row: TopicDetail }) {
  const refs = useMemo(() => {
    const seen = new Set<string>();
    const out: Ref[] = [];
    for (const id of row.references) {
      const r = fromId(id);
      if (r && !seen.has(refId(r))) {
        seen.add(refId(r));
        out.push(r);
      }
    }
    return out;
  }, [row]);
  return (
    <div className="mx-auto max-w-reading p-5">
      <h3 className="text-xl font-semibold leading-snug">{row.title}</h3>
      {row.source && <Small className="mt-1">{row.source}</Small>}
      {row.review_status && <Small className="mt-1">{row.review_status}</Small>}
      <Button
        variant="text"
        icon={Languages}
        className="-ml-3 mt-1"
        onClick={() => openLongText(tr('Original histórico', 'Historical original', 'Original histórico'), stripTags(row.original_body))}
      >
        {tr('Consultar o índice original em inglês', 'View the original English index', 'Consultar el índice original en inglés')}
      </Button>
      {refs.length > 0 && (
        <Disclosure
          defaultOpen={refs.length <= 12}
          title={`${tr('Passagens do tema', 'Passages of the topic', 'Pasajes del tema')} (${refs.length})`}
          subtitle={tr(
            'Associações editoriais na numeração KJV; leia no contexto.',
            'Editorial associations in KJV numbering; read in context.',
            'Asociaciones editoriales en la numeración KJV; lea en contexto.',
          )}
        >
          <RefChips refs={refs} sourceEdition="BLN4" initial={PAGE} step={PAGE} />
        </Disclosure>
      )}
      <div className="mt-5">
        <LongStudyText text={row.body} embedded />
      </div>
    </div>
  );
}

export function TopicPage({ id }: { id: string }) {
  useApp();
  const state = useAsync(() => topic(id), [id]);
  return (
    <Async state={state}>
      {(row) => (row ? <TopicView row={row} /> : <p className="p-6">{tr('Tema não instalado.', 'Topic not installed.', 'Tema no instalado.')}</p>)}
    </Async>
  );
}
