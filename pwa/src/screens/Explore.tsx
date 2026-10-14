// Área Explorar (lib/explore.dart): ExplorePage, TimelinePage,
// ContextComparisonPage e UnitsPage. O atlas fica em Atlas.tsx.
import {
  ArrowLeftRight,
  BookOpen,
  Box,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  History,
  Languages,
  Link as LinkIcon,
  MapPin,
  Network,
  Ruler,
} from 'lucide-react';
import { memo, useEffect, useId, useMemo, useState } from 'react';
import { app, useApp } from '../lib/app';
import { eventsAt, loadContext, type ContextEvent } from '../lib/content';
import { fromId, ref, refId, refLabel, type Lang, type Ref } from '../lib/domain';
import {
  MEASURES,
  UNITS_SOURCES,
  alternativeLine,
  comparableEvents,
  compareContext,
  convertMeasure,
  eventDates,
  measure,
  measureText,
  parseQuantity,
  sourceLabel,
  sourceUrl,
  timelineRows,
  type ComparisonResult,
  type Source,
} from '../lib/explore-logic';
import { lang, t, tr } from '../lib/i18n';
import {
  Action,
  Button,
  Card,
  Chip,
  ErrorBox,
  Feature,
  Field,
  ListItem,
  Progress,
  Select,
  Small,
  Spinner,
  Wrap,
  copyText,
  cx,
  message,
  useAsync,
  useDebounced,
} from '../components/ui';
import {
  choosePassage,
  openAtlas,
  openContextCompare,
  openGraph,
  openLinguistics,
  openModels,
  openTimeline,
  openUnits,
  showPassage,
} from './open';

// ------------------------------------------------------------- ExplorePage
export default function ExplorePage() {
  useApp();
  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-3xl p-[18px]">
        <h2 className="sr-only">{tr('Recursos para explorar', 'Resources to explore', 'Recursos para explorar')}</h2>
        <Feature
          title={t('timeline')}
          subtitle={tr('Eventos, propostas de datação e referências', 'Events, dating proposals and references', 'Eventos, propuestas de datación y referencias')}
          icon={History}
          onClick={() => openTimeline()}
        />
        <Feature
          title={t('map')}
          subtitle={tr('Cidades antigas, geografia atual e rotas estimadas', 'Ancient cities, present-day geography and estimated routes', 'Ciudades antiguas, geografía actual y rutas estimadas')}
          icon={Globe}
          onClick={() => openAtlas()}
        />
        <Feature
          title={t('contextCompare')}
          subtitle={tr('Dois acontecimentos: tempo, lugar e incerteza', 'Two events: time, place and uncertainty', 'Dos acontecimientos: tiempo, lugar e incertidumbre')}
          icon={ArrowLeftRight}
          onClick={() => openContextCompare(app.passage)}
        />
        <Feature
          title={t('models')}
          subtitle={tr(
            'Acervo com camadas, pesquisa e recursos a cada quatro capítulos',
            'Collection with layers, search and resources every four chapters',
            'Acervo con capas, búsqueda y recursos cada cuatro capítulos',
          )}
          icon={Box}
          onClick={() => openModels()}
        />
        <Feature
          title={t('units')}
          subtitle={tr('Unidades históricas e intervalos aproximados', 'Historical units and approximate ranges', 'Unidades históricas e intervalos aproximados')}
          icon={Ruler}
          onClick={openUnits}
        />
        <Feature
          title={t('linguistics')}
          subtitle={tr('Hebraico, aramaico, grego, Strong e morfologia', 'Hebrew, Aramaic, Greek, Strong and morphology', 'Hebreo, arameo, griego, Strong y morfología')}
          icon={Languages}
          onClick={openLinguistics}
        />
        <Feature
          title={t('graph')}
          subtitle={tr('Referências textuais, interpretações e notas pessoais', 'Textual references, interpretations and personal notes', 'Referencias textuales, interpretaciones y notas personales')}
          icon={Network}
          onClick={() => openGraph()}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------- fontes copiáveis
/** sourceLinks() de common.dart: tocar copia a fonte ("título\nurl" para objetos). */
export function SourceLinks({ sources, className, level = 4 }: { sources: Source[]; className?: string; level?: 3 | 4 }) {
  const list = (sources ?? []).filter((s) => sourceLabel(s).trim());
  if (list.length === 0) return null;
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <section className={cx('mt-4', className)}>
      <Heading className="text-[14.5px] font-semibold">{t('sources')}</Heading>
      <ul className="mt-1">
        {list.map((s, i) => {
          const label = sourceLabel(s);
          const url = sourceUrl(s);
          return (
            <li key={i} className="flex items-start gap-1">
              <button
                type="button"
                title={tr('Copiar fonte', 'Copy source', 'Copiar fuente')}
                className="flex min-h-[40px] min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-primary hover:bg-primary/10"
                onClick={async () => message((await copyText(label)) ? t('copy') : t('error'))}
              >
                <LinkIcon size={16} aria-hidden className="mt-0.5 shrink-0" />
                <span className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{label}</span>
              </button>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tr('Abrir fonte em nova aba', 'Open source in a new tab', 'Abrir fuente en una pestaña nueva')}
                  title={tr('Abrir fonte em nova aba', 'Open source in a new tab', 'Abrir fuente en una pestaña nueva')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-on-surface/10"
                >
                  <ExternalLink size={17} aria-hidden />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------ TimelinePage
const TIMELINE_PAGE = 40;

const EventCard = memo(function EventCard({ event: e, language }: { event: ContextEvent; language: Lang }) {
  const refs = useMemo(() => (e.references ?? []).map((r) => fromId(String(r))).filter((r): r is Ref => r !== null), [e]);
  return (
    <li>
      <Card className="p-[18px]">
        <h3 className="text-xl font-semibold leading-snug">{e.title}</h3>
        <p className="mt-0.5 text-[15px] text-muted">{eventDates(e, language)}</p>
        <p className="mt-3 select-text text-[15.5px] leading-relaxed">{e.description}</p>
        {(e.alternatives ?? []).length > 0 && (
          <ul className="mt-2 text-[15px]">
            {e.alternatives.map((alt, i) => (
              <li key={i}>{alternativeLine(alt, language)}</li>
            ))}
          </ul>
        )}
        {(refs.length > 0 || e.location) && (
          <Wrap className="-ml-3 mt-2 gap-1">
            {refs.map((r) => (
              <Action key={refId(r)} label={refLabel(r, language)} icon={BookOpen} onClick={() => showPassage(r, { sourceEdition: 'BLN4' })} />
            ))}
            {e.location && <Action label={t('map')} icon={MapPin} onClick={() => openAtlas(e.location)} />}
          </Wrap>
        )}
        <SourceLinks sources={e.sources ?? []} className="mt-2" />
      </Card>
    </li>
  );
});

export function TimelinePage({ reference }: { reference?: Ref }) {
  useApp();
  const language = lang();
  const state = useAsync(loadContext, []);
  const [world, setWorld] = useState(true);
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(TIMELINE_PAGE);
  const query = useDebounced(search, 250);
  const key = reference ? refId(reference) : '';
  const rows = useMemo(() => {
    const data = state.data;
    if (!data) return [];
    const events = !reference || all ? data.events : eventsAt(data, reference);
    return timelineRows(events, world, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data, key, all, world, query]);
  useEffect(() => setLimit(TIMELINE_PAGE), [key, all, world, query]);

  return (
    <div className="mx-auto max-w-3xl p-5">
      {reference && <p className="mb-2 text-xl font-semibold leading-snug">{refLabel(reference, language)}</p>}
      <Wrap>
        <Chip selected={world} onClick={() => setWorld((v) => !v)}>
          {t('world')}
        </Chip>
        {reference && (
          <Chip selected={all} onClick={() => setAll((v) => !v)}>
            {t('all')}
          </Chip>
        )}
      </Wrap>
      <Field
        label={t('search')}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
        className="mt-3"
      />
      <p className="mt-4 text-[15px]">
        {tr(
          'Datas dizem respeito ao acontecimento descrito. Um intervalo pode abranger propostas alternativas; não indica sempre sua duração.',
          'Dates refer to the event described. A range may span alternative proposals; it does not always indicate its duration.',
          'Las fechas se refieren al acontecimiento descrito. Un intervalo puede abarcar propuestas alternativas; no siempre indica su duración.',
        )}
      </p>
      <p className="sr-only" aria-live="polite">
        {state.data ? `${rows.length} ${tr('acontecimentos', 'events', 'acontecimientos')}` : ''}
      </p>
      {state.error ? (
        <ErrorBox error={state.error} onRetry={state.reload} />
      ) : !state.data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-[15px]">{t('insufficient')}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {rows.slice(0, limit).map((e) => (
              <EventCard key={e.id} event={e} language={language} />
            ))}
          </ul>
          {rows.length > limit && (
            <div className="flex justify-center py-3">
              <Button variant="text" onClick={() => setLimit((n) => n + TIMELINE_PAGE)}>
                {tr('Mostrar mais', 'Show more', 'Mostrar más')} ({rows.length - limit})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------- ContextComparisonPage
function ReferenceChoice({
  title,
  value,
  onChange,
  events,
  loading,
  language,
}: {
  title: string;
  value: Ref;
  onChange: (r: Ref) => void;
  events: ContextEvent[];
  loading: boolean;
  language: Lang;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <Card>
      <button
        type="button"
        onClick={() => choosePassage({ initial: value, onSelect: onChange })}
        className="flex min-h-[56px] w-full items-center gap-4 rounded-t-2xl px-4 py-3 text-left transition hover:bg-on-surface/5"
      >
        <BookOpen size={22} aria-hidden className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px]">{title}</span>
          <span className="block text-sm text-muted">{refLabel(value, language)}</span>
        </span>
        <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
      </button>
      <div className="border-t border-outline/30">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panel : undefined}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-on-surface/5"
        >
          <span className="min-w-0 flex-1 text-[15px]">{tr('Acontecimentos históricos', 'Historical events', 'Acontecimientos históricos')}</span>
          <ChevronDown size={20} aria-hidden className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div id={panel} className="px-1 pb-2">
            {loading ? (
              <div className="px-3 py-2">
                <Progress />
              </div>
            ) : (
              <ul>
                {events.map((e) => (
                  <li key={e.id}>
                    <ListItem
                      title={e.title}
                      subtitle={`${e.certainty} · ${tr('referência da perícope', 'pericope reference', 'referencia de la perícopa')}`}
                      onClick={() => {
                        const r = fromId(String(e.references[0]));
                        if (r) onChange(r);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ContextComparisonPage({ first }: { first: Ref }) {
  useApp();
  const language = lang();
  const state = useAsync(loadContext, []);
  const [a, setA] = useState<Ref>(first);
  const [b, setB] = useState<Ref>(() => ref(44, 28, 16));
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const events = useMemo(() => (state.data ? comparableEvents(state.data) : []), [state.data]);

  const change = (setter: (r: Ref) => void) => (r: Ref) => {
    setter(r);
    setResult(null);
  };
  const compare = () => {
    const data = state.data;
    if (!data) return;
    setResult(compareContext(data, eventsAt(data, a), eventsAt(data, b), language));
  };
  const focus = result?.chosen[0]?.location ?? null;

  return (
    <div className="mx-auto max-w-3xl p-5">
      <ReferenceChoice title={`1 · ${t('reference')}`} value={a} onChange={change(setA)} events={events} loading={!state.data} language={language} />
      <div className="h-3" />
      <ReferenceChoice title={`2 · ${t('reference')}`} value={b} onChange={change(setB)} events={events} loading={!state.data} language={language} />
      {state.error ? <ErrorBox error={state.error} onRetry={state.reload} /> : null}
      <Button className="mt-4 w-full sm:w-auto" icon={ArrowLeftRight} disabled={!state.data} onClick={compare}>
        {t('contextCompare')}
      </Button>
      <section aria-live="polite" className="mt-1">
        {result && (
          <>
            <p className="mt-5 select-text whitespace-pre-line text-[15.5px] leading-relaxed">{result.text}</p>
            <Wrap className="mt-4">
              <Button
                variant="text"
                icon={Copy}
                onClick={async () => message((await copyText(result.text)) ? t('copy') : t('error'))}
              >
                {t('copy')}
              </Button>
              {result.chosen.length > 0 && (
                <Button variant="outlined" icon={Globe} onClick={() => openAtlas(focus)}>
                  {t('map')}
                </Button>
              )}
            </Wrap>
          </>
        )}
      </section>
    </div>
  );
}

// --------------------------------------------------------------- UnitsPage
export function UnitsPage() {
  useApp();
  const language = lang();
  const [id, setId] = useState('cubit');
  const [value, setValue] = useState('1');
  const m = measure(id);
  const text = measureText(m, language);
  const result = convertMeasure(m, parseQuantity(value), language);
  const options = useMemo(() => MEASURES.map((x) => ({ value: x.id, label: measureText(x, language).name })), [language]);

  return (
    <div className="mx-auto max-w-3xl p-[22px]">
      <Select label={t('units')} value={id} onChange={(e) => setId(e.target.value)} options={options} />
      <Field
        label="Quantidade / Quantity"
        className="mt-4"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className="mt-6 select-text text-2xl leading-snug [overflow-wrap:anywhere]" aria-live="polite">
        {result ?? tr('Informe uma quantidade válida.', 'Enter a valid quantity.', 'Introduzca una cantidad válida.')}
      </p>
      <p className="mt-5 text-[15.5px] leading-relaxed">{text.notes}</p>
      <Small className="mt-4 text-[15px] leading-relaxed">
        {tr(
          'Modelo de conversão por intervalo. Valores são referências aproximadas e não representam todos os padrões de todas as épocas. Para pesquisa acadêmica, consulte o padrão metrológico do período e a fonte do objeto.',
          'Range-based conversion model. Values are approximate references and do not represent every standard of every period. For academic research, consult the metrological standard of the period and the source of the object.',
          'Modelo de conversión por intervalo. Los valores son referencias aproximadas y no representan todos los patrones de todas las épocas. Para investigación académica, consulte el patrón metrológico del período y la fuente del objeto.',
        )}
      </Small>
      <SourceLinks sources={UNITS_SOURCES} level={3} />
    </div>
  );
}
