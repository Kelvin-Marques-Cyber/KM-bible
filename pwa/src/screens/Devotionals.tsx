// Devocionais (pedido do proprietário): coleções instaladas de leitura diária —
// Café da Manhã com Spurgeon (366 dias, por data), Jornada Reformada (180
// leituras) e qualquer pacote devocional importado (ex.: Josemar Bessa). Cada
// coleção mostra o progresso, a leitura de hoje e a lista completa; o leitor
// navega dentro da coleção, marca como lido, copia com créditos e anota.
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Circle,
  CircleCheck,
  Copy,
  History,
  Info,
  Library,
  ListChecks,
  NotebookPen,
  Sunrise,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Action,
  Button,
  Card,
  Chip,
  ErrorBox,
  ListItem,
  Progress,
  Small,
  Spinner,
  Toggle,
  Wrap,
  copyText,
  message,
  useAsync,
  useDebounced,
} from '../components/ui';
import { fontSize, openSheet, useApp } from '../lib/app';
import { module, type DocumentRow } from '../lib/content';
import { fold, fromId, refLabel } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { pref, setPref, storeRevision } from '../lib/store';
import { countRead, devotionalCollections, isRead, loadCollection, markRead, readDocumentIds, type Collection } from '../lib/studies-data';
import { scrollToTop } from '../lib/studies-hooks';
import {
  devotionalCopyText,
  devotionalHaystack,
  devotionalLastKey,
  firstUnreadIndex,
  shortTitle,
  todayIndex,
} from '../lib/studies-logic';
import { LongMarkdown, SearchField, SourceList, VirtualRows } from '../lib/studies-ui';
import { openDevotional, openLibrary, openNewNote, showPassage } from './open';

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Corpo das leituras: fonte de leitura, proporcional ao tamanho escolhido (como os documentos). */
const bodySize = () => Math.round(Math.min(34, Math.max(15, fontSize() * 0.78)));

/** Texto pesquisável de cada coleção, montado uma única vez (na primeira busca) e reaproveitado. */
const haystacks = new WeakMap<DocumentRow[], string[]>();
function haystackOf(docs: DocumentRow[]): string[] {
  let list = haystacks.get(docs);
  if (!list) haystacks.set(docs, (list = docs.map(devotionalHaystack)));
  return list;
}

/** Leitura que "Leitura de hoje" abre: o dia do calendário ou a primeira ainda não lida. */
export function todayDocument(docs: DocumentRow[], calendar: boolean, date = new Date()): DocumentRow | undefined {
  if (docs.length === 0) return undefined;
  return docs[calendar ? todayIndex(docs, date) : firstUnreadIndex(docs, isRead)];
}

/** A coleção vem de um pacote do Josemar Bessa importado pelo usuário? */
const isBessaPackage = (c: Collection) => !c.builtin && /bessa/i.test(`${c.title} ${c.author} ${c.source}`);

// ================================================================== Menu
export default function DevotionalsPage() {
  useApp();
  const language = lang();
  const revision = storeRevision();
  const collections = devotionalCollections(language);
  // Marcas de leitura (learning_progress) — relidas quando os dados pessoais mudam.
  const read = useAsync(readDocumentIds, [revision]);
  const hasBessa = collections.some(isBessaPackage);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-5">
      <p className="text-[15px] leading-relaxed">
        {tr(
          'Leituras diárias para meditação, com a passagem bíblica, o texto completo e o progresso guardado neste aparelho.',
          'Daily readings for meditation, with the Bible passage, the full text and progress saved on this device.',
          'Lecturas diarias para meditación, con el pasaje bíblico, el texto completo y el progreso guardado en este dispositivo.',
        )}
      </p>
      {collections.length === 0 ? (
        <p role="status" className="mt-4 rounded-xl bg-secondary-container p-3 text-[15px]">
          {tr(
            'Nenhuma coleção devocional está instalada. Ative-a em Biblioteca ou importe um pacote devocional.',
            'No devotional collection is installed. Enable one in the Library or import a devotional package.',
            'No hay ninguna colección devocional instalada. Actívela en la Biblioteca o importe un paquete devocional.',
          )}
        </p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label={tr('Coleções devocionais', 'Devotional collections', 'Colecciones devocionales')}>
          {collections.map((c) => (
            <li key={c.id}>
              <CollectionCard collection={c} readIds={read.data} />
            </li>
          ))}
        </ul>
      )}
      {!hasBessa && (
        <Card className="mt-4 p-4">
          <div className="flex items-start gap-3">
            <Info size={22} aria-hidden className="mt-0.5 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-[15px] leading-relaxed">
              {tr(
                'Devocionais de Josemar Bessa — importe o pacote autorizado (.biblepkg) em Biblioteca → Importar módulo; ele aparecerá aqui automaticamente.',
                "Josemar Bessa's devotionals — import the authorized package (.biblepkg) in Library → Import module; it will appear here automatically.",
                'Devocionales de Josemar Bessa — importe el paquete autorizado (.biblepkg) en Biblioteca → Importar módulo; aparecerá aquí automáticamente.',
              )}
            </p>
          </div>
          <Button variant="tonal" icon={Library} className="mt-3" onClick={openLibrary}>
            {tr('Abrir a Biblioteca', 'Open the Library', 'Abrir la Biblioteca')}
          </Button>
        </Card>
      )}
    </div>
  );
}

function countLabel(c: Collection): string {
  if (c.count === null) return tr('Coleção importada', 'Imported collection', 'Colección importada');
  return c.calendar
    ? tr(`${c.count} dias · leitura por data`, `${c.count} days · read by date`, `${c.count} días · lectura por fecha`)
    : tr(`${c.count} leituras`, `${c.count} readings`, `${c.count} lecturas`);
}

function CollectionCard({ collection: c, readIds }: { collection: Collection; readIds: Set<string> | undefined }) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const done = readIds ? countRead(c, readIds) : null;
  const last = pref<string>(devotionalLastKey(c.id), '');
  const titleId = useId();

  // Carrega a coleção só quando pedida; se a folha fechar antes, nada é aberto.
  const openToday = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { docs, calendar } = await loadCollection(c.id);
      if (!mounted.current) return;
      const doc = todayDocument(docs, calendar);
      if (doc) openDevotional(c.id, c.name, doc.id);
      else message(t('empty'));
    } catch (error) {
      if (mounted.current) message(`${t('error')}: ${errorText(error)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {c.calendar ? (
          <Sunrise size={28} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        ) : (
          <CalendarDays size={28} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        )}
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-[18px] font-semibold leading-snug">
            {c.name}
          </h3>
          {c.author && <p className="text-sm text-muted">{c.author}</p>}
          <p className="text-sm text-muted">{countLabel(c)}</p>
        </div>
      </div>
      <div className="mt-3" aria-live="polite">
        {done !== null && (
          <>
            {c.count ? <Progress value={Math.min(1, done / c.count)} /> : null}
            <p className="mt-1 text-sm">
              {c.count
                ? tr(`${done} de ${c.count} lidas`, `${done} of ${c.count} read`, `${done} de ${c.count} leídas`)
                : tr(`${done} lidas`, `${done} read`, `${done} leídas`)}
            </p>
          </>
        )}
      </div>
      <Wrap className="mt-3">
        <Button icon={CalendarCheck} onClick={() => void openToday()} disabled={busy} aria-busy={busy} aria-describedby={titleId}>
          {tr('Leitura de hoje', "Today's reading", 'Lectura de hoy')}
        </Button>
        <Button variant="tonal" icon={ListChecks} onClick={() => openReadingList(c)} aria-describedby={titleId}>
          {tr('Todas as leituras', 'All readings', 'Todas las lecturas')}
        </Button>
        {last && (
          <Button variant="text" icon={History} onClick={() => openDevotional(c.id, c.name, last)} aria-describedby={titleId}>
            {tr('Continuar', 'Continue', 'Continuar')}
          </Button>
        )}
      </Wrap>
      {c.calendar === false && (
        <Small className="mt-2">
          {tr(
            'A leitura de hoje é a próxima ainda não marcada como lida.',
            "Today's reading is the next one not yet marked as read.",
            'La lectura de hoy es la próxima aún no marcada como leída.',
          )}
        </Small>
      )}
    </Card>
  );
}

// ======================================================= Todas as leituras
function openReadingList(c: Collection) {
  openSheet(`${tr('Todas as leituras', 'All readings', 'Todas las lecturas')} · ${c.name}`, () => <ReadingList moduleId={c.id} name={c.name} />);
}

type ReadFilter = 'all' | 'unread' | 'read';

export function ReadingList({ moduleId, name }: { moduleId: string; name: string }) {
  useApp();
  const language = lang();
  const revision = storeRevision();
  const state = useAsync(() => loadCollection(moduleId), [moduleId]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ReadFilter>('all');
  const query = useDebounced(search, 250);
  const q = fold(query);
  const docs = useMemo(() => state.data?.docs ?? [], [state.data]);
  // Texto pesquisável (sem acentos) montado uma única vez, só quando há busca.
  const searching = q.length > 0;
  const haystack = useMemo(() => (searching ? haystackOf(docs) : null), [docs, searching]);
  const todayId = useMemo(() => (state.data?.calendar ? docs[todayIndex(docs)]?.id ?? null : null), [docs, state.data]);
  const rows = useMemo(
    () =>
      docs.filter(
        (d, i) => (!haystack || haystack[i].includes(q)) && (filter === 'all' || (filter === 'read') === isRead(d.id)),
      ),
    // A revisão dos dados pessoais muda quando uma leitura é marcada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs, haystack, q, filter, revision],
  );

  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return <Spinner />;
  return (
    <div className="mx-auto max-w-3xl px-3 pb-6 pt-3">
      <div className="px-1">
        <SearchField className="mt-0" label={tr('Procurar nas leituras', 'Search the readings', 'Buscar en las lecturas')} value={search} onChange={setSearch} />
        <Wrap className="mt-3">
          {(
            [
              ['all', t('all')],
              ['unread', tr('Não lidas', 'Unread', 'No leídas')],
              ['read', tr('Lidas', 'Read', 'Leídas')],
            ] as [ReadFilter, string][]
          ).map(([value, label]) => (
            <Chip key={value} selected={filter === value} onClick={() => setFilter(value)}>
              {label}
            </Chip>
          ))}
        </Wrap>
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          {tr(`${rows.length} de ${docs.length} leituras`, `${rows.length} of ${docs.length} readings`, `${rows.length} de ${docs.length} lecturas`)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="p-3 text-[15px]">{t('empty')}</p>
      ) : (
        <VirtualRows
          className="mt-1"
          label={name}
          rows={rows}
          estimate={() => 72}
          rowKey={(d) => d.id}
          render={(d: DocumentRow) => {
            const done = isRead(d.id);
            const r = fromId(d.reference);
            const subtitle = [
              d.id === todayId ? tr('Hoje', 'Today', 'Hoy') : '',
              r ? refLabel(r, language) : '',
              done ? tr('Lida', 'Read', 'Leída') : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <ListItem
                leading={done ? CircleCheck : Circle}
                title={shortTitle(d.title)}
                subtitle={subtitle || undefined}
                selected={d.id === todayId}
                trailing="chevron"
                onClick={() => openDevotional(moduleId, name, d.id)}
              />
            );
          }}
        />
      )}
    </div>
  );
}

// ================================================================= Leitor
export function DevotionalReader({ moduleId, documentId }: { moduleId: string; documentId?: string }) {
  useApp();
  const state = useAsync(() => loadCollection(moduleId), [moduleId]);
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return <Spinner />;
  const { docs, calendar } = state.data;
  if (docs.length === 0) {
    return <p className="mx-auto max-w-reading p-5 text-[15px]">{tr('Esta coleção não tem leituras instaladas.', 'This collection has no installed readings.', 'Esta colección no tiene lecturas instaladas.')}</p>;
  }
  return <Reading moduleId={moduleId} docs={docs} calendar={calendar} documentId={documentId} />;
}

function initialIndex(docs: DocumentRow[], calendar: boolean, moduleId: string, documentId?: string): number {
  for (const id of [documentId, pref<string>(devotionalLastKey(moduleId), '')]) {
    if (!id) continue;
    const index = docs.findIndex((d) => d.id === id);
    if (index >= 0) return index;
  }
  const today = todayDocument(docs, calendar);
  return today ? docs.indexOf(today) : 0;
}

function Reading({ moduleId, docs, calendar, documentId }: { moduleId: string; docs: DocumentRow[]; calendar: boolean; documentId?: string }) {
  const language = lang();
  const [index, setIndex] = useState(() => initialIndex(docs, calendar, moduleId, documentId));
  const top = useRef<HTMLElement>(null);
  const titleId = useId();
  const doc = docs[Math.min(index, docs.length - 1)];
  const m = module(moduleId);
  const r = fromId(doc.reference);
  const done = isRead(doc.id);
  const builtin = m?.origin !== 'user';

  // Lembra a última leitura aberta desta coleção.
  useEffect(() => {
    if (pref<string>(devotionalLastKey(moduleId), '') !== doc.id) void setPref(devotionalLastKey(moduleId), doc.id, false);
  }, [moduleId, doc.id]);

  const go = (next: number) => {
    if (next < 0 || next >= docs.length) return;
    setIndex(next);
    scrollToTop(top.current);
  };

  const copy = async () => {
    const ok = await copyText(devotionalCopyText(doc, m));
    message(ok ? tr('Leitura copiada com os créditos.', 'Reading copied with credits.', 'Lectura copiada con los créditos.') : t('error'));
  };

  return (
    <article ref={top} className="mx-auto max-w-reading p-5" aria-labelledby={titleId}>
      <p className="text-sm font-medium text-muted">
        {calendar
          ? tr(`Dia ${index + 1} de ${docs.length}`, `Day ${index + 1} of ${docs.length}`, `Día ${index + 1} de ${docs.length}`)
          : tr(`Leitura ${index + 1} de ${docs.length}`, `Reading ${index + 1} of ${docs.length}`, `Lectura ${index + 1} de ${docs.length}`)}
      </p>
      <h3 id={titleId} className="mt-1 select-text text-[21px] font-semibold leading-snug" aria-live="polite">
        {shortTitle(doc.title)}
      </h3>
      {r && (
        <Wrap className="mt-3">
          <Chip icon={BookOpen} onClick={() => showPassage(r, builtin ? { sourceEdition: 'BLN4' } : {})}>
            {refLabel(r, language)}
          </Chip>
        </Wrap>
      )}
      <div className="mt-4" style={{ fontSize: bodySize() }}>
        <LongMarkdown key={doc.id} text={doc.body} className="select-text font-reading" />
      </div>
      <div className="mt-5 rounded-2xl px-1">
        <Toggle label={tr('Marcar como lido', 'Mark as read', 'Marcar como leído')} checked={done} onChange={(value) => void markRead(doc.id, value)} />
      </div>
      <Wrap className="mt-1 gap-1">
        <Action label={t('copy')} icon={Copy} onClick={() => void copy()} />
        <Action
          label={t('note')}
          icon={NotebookPen}
          onClick={() => void openNewNote({ title: doc.title, body: `[[${doc.id}]]\n\n`, reference: doc.id, notebook: 'Devocionais' })}
        />
      </Wrap>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outlined" icon={ArrowLeft} disabled={index <= 0} onClick={() => go(index - 1)}>
          {tr('Anterior', 'Previous', 'Anterior')}
        </Button>
        <Button icon={ArrowRight} disabled={index >= docs.length - 1} onClick={() => go(index + 1)}>
          {tr('Próxima', 'Next', 'Siguiente')}
        </Button>
      </div>
      {m && (
        <footer className="mt-6 border-t border-outline/40 pt-3">
          <Small className="select-text [overflow-wrap:anywhere]">{[m.author, m.title].filter(Boolean).join(' · ')}</Small>
          {m.license && <Small className="mt-1 select-text [overflow-wrap:anywhere]">{m.license}</Small>}
          <SourceList sources={m.source ? [m.source] : []} className="mt-2" />
        </footer>
      )}
    </article>
  );
}
