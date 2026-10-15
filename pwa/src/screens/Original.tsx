// Idiomas originais: interlinear por versículo, léxico Strong e pesquisa
// linguística. Todo o acervo é local ao PWA; sem serviços de IA ou traduções inventadas.
import {
  ArrowRight, BookOpen, BookText, Copy, Hash, Info, Languages, Library,
  NotebookPen, Search, ScrollText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { app, useApp } from '../lib/app';
import {
  lexeme, occurrences, strongId, verse, wordsAt,
  type Occurrence, type Word,
} from '../lib/content';
import { fromId, refId, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { morphology } from '../lib/original-logic';
import {
  releaseIndex, retainIndex, runSearch,
  type SearchMode, type SearchOutcome, type SearchStatus,
} from '../lib/original-search';
import {
  Button, Card, Chip, ErrorBox, Progress, Select, Spinner, Wrap,
  copyText, message, useAsync, useDebounced,
} from '../components/ui';
import { openLexeme, openLibrary, openLinguistics, openNewNote, showPassage } from './open';

const formatError = (error: unknown) => error instanceof Error ? error.message : String(error);
const originalDirection = (book: number): 'rtl' | 'ltr' => book <= 39 ? 'rtl' : 'ltr';

const lexiconHelp = () => tr(
  'As traduções e definições vêm do acervo instalado. Uma glosa é uma ajuda lexical, não uma tradução definitiva do versículo.',
  'Translations and definitions come from installed sources. A gloss is a lexical aid, not a definitive verse translation.',
  'Las traducciones y definiciones proceden del acervo instalado. Una glosa es una ayuda léxica, no una traducción definitiva.',
);

function EmptyOriginal() {
  return (
    <Card className="mt-4 p-4">
      <p className="font-medium">{t('noContent')}</p>
      <p className="mt-2 text-sm text-muted">
        {tr(
          'Não há palavras originais disponíveis neste versículo com os módulos instalados. Verifique a Biblioteca ou escolha outra passagem.',
          'No original-language words are available for this verse with the installed modules. Check the Library or choose another passage.',
          'No hay palabras originales disponibles para este versículo con los módulos instalados. Consulte la Biblioteca o elija otro pasaje.',
        )}
      </p>
      <Button variant="tonal" icon={Library} className="mt-3" onClick={openLibrary}>{t('library')}</Button>
    </Card>
  );
}

function WordCard({ word, direction }: { word: Word; direction: 'ltr' | 'rtl' }) {
  const id = strongId(word.lexeme);
  const label = [word.surface, word.transliteration, id].filter(Boolean).join(' · ');
  return (
    <li className="min-w-[105px] max-w-[180px] flex-1 rounded-xl border border-outline/40 bg-surface px-2 py-3 text-center sm:flex-none">
      <button
        type="button"
        onClick={() => id && openLexeme(id)}
        disabled={!id}
        title={label}
        aria-label={tr('Consultar no léxico: ', 'Look up in the lexicon: ', 'Consultar en el léxico: ') + label}
        className="group w-full disabled:cursor-default"
      >
        <span lang={direction === 'rtl' ? 'he' : 'grc'} dir={direction} className="block break-words font-reading text-[26px] leading-relaxed text-on-surface group-enabled:hover:text-primary">
          {word.surface}
        </span>
        {word.transliteration && <span dir="ltr" className="mt-1 block break-words text-[13px] text-muted">{word.transliteration}</span>}
        {id && <span dir="ltr" className="mt-1 inline-block rounded-md bg-secondary-container px-1.5 py-0.5 text-xs font-semibold">{id}</span>}
        <span className="mt-1 block break-words text-[13px] leading-snug">{word.gloss || tr('Glosa indisponível', 'Gloss unavailable', 'Glosa no disponible')}</span>
      </button>
      {word.morphology && (
        <details className="mt-2 border-t border-outline/30 pt-2 text-left text-xs text-muted">
          <summary className="cursor-pointer text-center">{tr('Morfologia', 'Morphology', 'Morfología')}</summary>
          <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{morphology(word.morphology)}</p>
        </details>
      )}
    </li>
  );
}

/** Interlinear por versículo, ordenado pelo índice original de cada edição. */
export function OriginalPage({ reference }: { reference: Ref }) {
  useApp();
  const language = lang();
  const translation = app.translation;
  const key = refId(reference);
  const state = useAsync(() => wordsAt(reference, translation), [key, translation]);
  const context = useAsync(() => verse(translation, reference), [key, translation]);
  const [edition, setEdition] = useState('');
  const grouped = useMemo(() => {
    const map = new Map<string, Word[]>();
    for (const word of state.data ?? []) {
      if (!map.has(word.edition)) map.set(word.edition, []);
      map.get(word.edition)!.push(word);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [state.data]);
  const editions = [...grouped.keys()];
  const selected = grouped.has(edition) ? edition : editions[0] ?? '';
  const words = grouped.get(selected) ?? [];
  const direction = originalDirection(reference.book);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-8 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{tr('Texto bíblico e análise interlinear', 'Biblical text and interlinear analysis', 'Texto bíblico y análisis interlineal')}</p>
          <h3 className="mt-1 font-reading text-[27px]">{refLabel(reference, language)}</h3>
        </div>
        <Button variant="outlined" icon={Search} onClick={openLinguistics}>{tr('Pesquisar termos', 'Search terms', 'Buscar términos')}</Button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{lexiconHelp()}</p>
      {context.data?.text && (
        <Card className="mt-4 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{translation} · {refLabel(reference, language)}</p>
          <p className="select-text font-reading text-[20px] leading-relaxed">{context.data.text}</p>
        </Card>
      )}
      {state.loading && <Spinner />}
      {state.error && <ErrorBox error={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && (
        editions.length === 0 ? <EmptyOriginal /> : (
          <>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-xs flex-1">
                <Select
                  label={tr('Edição do texto original', 'Original text edition', 'Edición del texto original')}
                  value={selected}
                  onChange={(event) => setEdition(event.target.value)}
                  options={editions.map((value) => ({ value, label: value }))}
                />
              </div>
              <span role="status" className="pb-2 text-sm text-muted">
                {words.length} {tr('palavras', 'words', 'palabras')}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">
              {tr('Toque numa palavra para abrir seu verbete; expanda Morfologia para examinar sua forma.', 'Tap a word to view its entry; expand Morphology to examine its form.', 'Toque una palabra para abrir su entrada; despliegue Morfología para examinar su forma.')}
            </p>
            <ul dir={direction} aria-label={tr('Texto interlinear', 'Interlinear text', 'Texto interlineal')} className="mt-3 flex flex-wrap items-stretch gap-2">
              {words.map((word, index) => <WordCard key={selected + ':' + word.position + ':' + index} word={word} direction={direction} />)}
            </ul>
            <Wrap className="mt-5">
              <Button variant="outlined" icon={Copy} onClick={() => void copyText(words.map((w) => w.surface).join(' ')).then((ok) => message(ok ? tr('Texto copiado', 'Text copied', 'Texto copiado') : t('error')))}>
                {tr('Copiar texto original', 'Copy original text', 'Copiar texto original')}
              </Button>
              <Button variant="outlined" icon={NotebookPen} onClick={() => void openNewNote({ title: tr('Estudo de ', 'Study of ', 'Estudio de ') + refLabel(reference, language), reference: key })}>{t('note')}</Button>
            </Wrap>
          </>
        )
      )}
      <p className="mt-5 text-xs text-muted">{tr('A disponibilidade de textos, morfologia e glosas depende da edição e da licença do módulo instalado.', 'Text, morphology and gloss availability depend on installed editions and their licences.', 'La disponibilidad de textos, morfología y glosas depende de las ediciones instaladas y sus licencias.')}</p>
    </div>
  );
}

function OccurrenceList({ rows, total, language }: { rows: Occurrence[]; total: number; language: string }) {
  const [limit, setLimit] = useState(30);
  return (
    <section aria-label={tr('Ocorrências', 'Occurrences', 'Ocurrencias')}>
      <p className="mb-3 mt-5 text-sm text-muted">{tr('Ocorrências indexadas', 'Indexed occurrences', 'Ocurrencias indexadas')}: {total.toLocaleString(language)}</p>
      {rows.length === 0 ? <p className="text-sm text-muted">{t('empty')}</p> : (
        <>
          <ul className="divide-y divide-outline/30 rounded-xl bg-surface-low">
            {rows.slice(0, limit).map((row, index) => {
              const reference = fromId(row.reference);
              return (
                <li key={row.edition + ':' + row.reference + ':' + index}>
                  <button
                    type="button"
                    disabled={!reference}
                    onClick={() => reference && showPassage(reference, { sourceEdition: row.edition })}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-on-surface/5 disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{reference ? refLabel(reference, language) : row.reference} · {row.edition}</span>
                      <span className="block break-words text-sm text-muted">{row.surface} {row.morphology ? '· ' + row.morphology : ''}</span>
                    </span>
                    <ArrowRight size={18} aria-hidden className="shrink-0 text-primary" />
                  </button>
                </li>
              );
            })}
          </ul>
          {rows.length > limit && <Button variant="text" className="mt-3" onClick={() => setLimit((n) => n + 30)}>{t('more')}</Button>}
        </>
      )}
    </section>
  );
}

/** Verbete Strong com fontes explícitas, sem inferir sentido teológico de uma glosa. */
export function LexemePage({ id }: { id: string }) {
  useApp();
  const language = lang();
  const key = strongId(id);
  const entry = useAsync(() => lexeme(key), [key]);
  const hits = useAsync(() => occurrences(key), [key]);
  return (
    <div className="mx-auto max-w-3xl p-4 pb-8 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-secondary-container p-3 text-primary"><BookText size={24} aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-sm text-muted">{tr('Dicionário do idioma original', 'Original language dictionary', 'Diccionario del idioma original')}</p>
          <h3 className="text-2xl font-semibold">{key}</h3>
        </div>
      </div>
      {entry.loading ? <Spinner /> : entry.error ? <ErrorBox error={entry.error} onRetry={entry.reload} /> : !entry.data ? (
        <EmptyOriginal />
      ) : (
        <article className="mt-4">
          <h4 lang={/^H/i.test(key) ? 'he' : 'grc'} dir={/^H/i.test(key) ? 'rtl' : 'ltr'} className="font-reading text-[36px] leading-snug">{entry.data.lemma}</h4>
          {entry.data.transliteration && <p className="mt-1 text-lg text-muted">{entry.data.transliteration}</p>}
          <p className="mt-2 text-xs text-muted">{[entry.data.language, entry.data.source].filter(Boolean).join(' · ')}</p>
          {(entry.data.pt?.gloss || entry.data.gloss) && (
            <Card className="mt-4 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tr('Glosa', 'Gloss', 'Glosa')}</p>
              <p className="mt-2 select-text text-[19px] leading-relaxed">{entry.data.pt?.gloss || entry.data.gloss}</p>
            </Card>
          )}
          {entry.data.pt?.body && (
            <section className="mt-5">
              <h5 className="font-semibold">{tr('Explicação em português', 'Portuguese explanation', 'Explicación en portugués')}</h5>
              <p className="mt-2 whitespace-pre-wrap select-text leading-relaxed">{entry.data.pt.body}</p>
            </section>
          )}
          {entry.data.definition && (
            <section className="mt-5">
              <h5 className="font-semibold">{tr('Definição da fonte', 'Source definition', 'Definición de la fuente')}</h5>
              <p className="mt-2 whitespace-pre-wrap select-text leading-relaxed">{entry.data.definition}</p>
            </section>
          )}
          <Wrap className="mt-5">
            <Button icon={Copy} variant="outlined" onClick={() => void copyText([key, entry.data!.lemma, entry.data!.pt?.gloss || entry.data!.gloss, entry.data!.source].filter(Boolean).join(' — ')).then((ok) => message(ok ? tr('Verbete copiado', 'Entry copied', 'Entrada copiada') : t('error')))}>{t('copy')}</Button>
          </Wrap>
          <p className="mt-4 flex items-start gap-2 text-sm text-muted"><Info size={17} className="mt-0.5 shrink-0" aria-hidden />{lexiconHelp()}</p>
        </article>
      )}
      {hits.loading ? <Spinner /> : hits.error ? <ErrorBox error={hits.error} onRetry={hits.reload} /> : hits.data && (
        <OccurrenceList key={key} rows={hits.data.rows} total={hits.data.frequency} language={language} />
      )}
    </div>
  );
}

const modes: { id: SearchMode; pt: string; en: string; es: string; example: string }[] = [
  { id: 'lemma', pt: 'Lema', en: 'Lemma', es: 'Lema', example: 'λόγος' },
  { id: 'surface', pt: 'Forma', en: 'Surface', es: 'Forma', example: 'בְּרֵאשִׁית' },
  { id: 'morphology', pt: 'Morfologia', en: 'Morphology', es: 'Morfología', example: 'V-PAI-3S' },
  { id: 'Strong', pt: 'Strong', en: 'Strong', es: 'Strong', example: 'G3056' },
];

function modeText(mode: SearchMode) {
  const row = modes.find((m) => m.id === mode)!;
  return tr(row.pt, row.en, row.es);
}
function statusText(status: SearchStatus | null) {
  if (!status) return t('loading');
  if (status.phase === 'download') return tr('Baixando índice…', 'Loading index…', 'Cargando índice…');
  if (status.phase === 'index') return tr('Preparando índice…', 'Preparing index…', 'Preparando índice…') + ' ' + Math.round(status.value * 100) + '%';
  if (status.phase === 'occurrences') return tr('Lendo ocorrências…', 'Reading occurrences…', 'Leyendo ocurrencias…') + ' ' + status.done + '/' + status.total;
  return t('loading');
}

/** Pesquisa assíncrona com cancelamento lógico e fallback ao Worker. */
export function LinguisticSearchPage() {
  useApp();
  const language = lang();
  const [mode, setMode] = useState<SearchMode>('lemma');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 300);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [result, setResult] = useState<SearchOutcome | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(35);

  useEffect(() => {
    retainIndex();
    return () => releaseIndex();
  }, []);
  useEffect(() => {
    let active = true;
    const q = debounced.trim();
    setLimit(35);
    setResult(null);
    setError(null);
    setStatus(null);
    if (!q) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    void runSearch(mode, q, {
      alive: () => active,
      onStatus: (next) => { if (active) setStatus(next); },
    }).then(
      (data) => { if (active) { setResult(data); setLoading(false); } },
      (reason) => { if (active) { setError(reason); setLoading(false); } },
    );
    return () => { active = false; };
  }, [mode, debounced]);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-8 sm:p-5">
      <div className="flex items-start gap-3">
        <Languages size={28} className="mt-1 shrink-0 text-primary" aria-hidden />
        <div>
          <h3 className="text-xl font-semibold">{tr('Pesquisa linguística', 'Linguistic search', 'Búsqueda lingüística')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {tr('Busque formas, lemas, códigos morfológicos ou referências Strong no corpus disponível.', 'Search forms, lemmas, morphological codes or Strong references in the available corpus.', 'Busque formas, lemas, códigos morfológicos o referencias Strong en el corpus disponible.')}
          </p>
        </div>
      </div>
      <Wrap className="mt-5">
        {modes.map((item) => <Chip key={item.id} selected={mode === item.id} onClick={() => { setMode(item.id); setQuery(''); }}>{tr(item.pt, item.en, item.es)}</Chip>)}
      </Wrap>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium">{tr('Pesquisar por ', 'Search by ', 'Buscar por ') + modeText(mode)}</span>
        <span className="flex items-center gap-2 rounded-xl border border-outline bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Search size={19} className="shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            autoComplete="off"
            dir="auto"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={modes.find((m) => m.id === mode)?.example}
            className="min-h-12 w-full min-w-0 bg-transparent text-[16px] outline-none"
          />
        </span>
      </label>
      {loading && (
        <div className="mt-4" role="status">
          <p className="mb-2 text-sm text-muted">{statusText(status)}</p>
          <Progress value={status?.phase === 'index' ? status.value : status?.phase === 'occurrences' && status.total ? status.done / status.total : undefined} />
        </div>
      )}
      {error && <ErrorBox error={error} onRetry={() => setQuery((q) => q + ' ' .trim())} />}
      {!loading && !error && result && (
        <div className="mt-5">
          <p role="status" className="text-sm font-medium">
            {result.rows.length.toLocaleString(language)} {tr('ocorrências apresentadas', 'occurrences displayed', 'ocurrencias mostradas')}
            {' · '}{result.matches.toLocaleString(language)} {tr('correspondências', 'matches', 'coincidencias')}
          </p>
          {(result.limited || result.partial) && <p className="mt-2 rounded-xl bg-secondary-container p-3 text-sm">
            {tr('Resultado parcial para preservar memória e dados. Refine sua busca para encontrar uma ocorrência específica.', 'Results limited to save memory and bandwidth. Refine your query to find a specific occurrence.', 'Resultados limitados para ahorrar memoria y datos. Precise la búsqueda para encontrar una ocurrencia.')}
          </p>}
          {result.suggestions.length > 0 && (
            <section className="mt-4">
              <h4 className="mb-2 text-sm font-medium">{tr('Termos relacionados', 'Related terms', 'Términos relacionados')}</h4>
              <Wrap>
                {result.suggestions.map((item, index) => <button key={item.lexeme + ':' + index} type="button" onClick={() => openLexeme(item.lexeme)} className="rounded-xl border border-outline px-3 py-2 text-left text-sm transition hover:bg-on-surface/5">
                  <span dir="auto" className="block font-medium">{item.label}</span>
                  <span className="text-xs text-muted">{item.detail || item.lexeme}</span>
                </button>)}
              </Wrap>
            </section>
          )}
          {result.rows.length === 0 && <p className="mt-5 text-sm text-muted">{t('empty')}</p>}
          {result.rows.length > 0 && (
            <ul className="mt-4 divide-y divide-outline/30 rounded-xl bg-surface-low" aria-label={tr('Ocorrências encontradas', 'Found occurrences', 'Ocurrencias encontradas')}>
              {result.rows.slice(0, limit).map((row, index) => {
                const reference = fromId(row.reference);
                return (
                  <li key={row.key + ':' + index}>
                    <button type="button" disabled={!reference} onClick={() => reference && showPassage(reference, { sourceEdition: row.edition })} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-on-surface/5 disabled:opacity-60">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{reference ? refLabel(reference, language) : row.reference} · {row.edition}</span>
                        <span dir="auto" className="mt-1 block break-words text-[19px]">{row.surface}</span>
                        {row.morphology && <span className="mt-0.5 block text-xs text-muted">{row.morphology}</span>}
                      </span>
                      <ArrowRight size={18} className="shrink-0 text-primary" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {result.rows.length > limit && <Button variant="text" className="mt-3" onClick={() => setLimit((n) => n + 35)}>{t('more')}</Button>}
        </div>
      )}
      {!query.trim() && <Card className="mt-5 p-4">
        <div className="flex items-start gap-2">
          <Info size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-muted">
            {tr('A busca funciona sobre os índices do acervo disponível e pode ser reutilizada offline após o download dos pacotes.', 'Search uses the available corpus indexes and works offline once the required packs have been downloaded.', 'La búsqueda usa los índices del corpus disponible y funciona sin conexión tras descargar los paquetes.')}
          </p>
        </div>
        <Button variant="text" icon={BookOpen} className="mt-2" onClick={openLibrary}>{t('library')}</Button>
      </Card>}
    </div>
  );
}
