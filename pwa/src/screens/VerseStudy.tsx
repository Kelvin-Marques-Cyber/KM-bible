// VerseStudyPage (lib/verse_study.dart): estudo conectado de uma passagem —
// temas, referências cruzadas, comentários, original, 3D, contexto histórico e
// literário, teologia e diálogo. Cada parte carrega sozinha (renderização
// progressiva): uma parte lenta ou indisponível não bloqueia as demais.
import {
  ArrowLeftRight,
  BookOpen,
  Box,
  CalendarClock,
  FileText,
  Globe,
  GraduationCap,
  Languages,
  LibraryBig,
  Map as MapIcon,
  MessageSquare,
  MessagesSquare,
  Network,
  Tag,
  Waypoints,
} from 'lucide-react';
import { useId, useMemo, useRef, type ReactNode } from 'react';
import { app, useApp } from '../lib/app';
import {
  allStudies,
  bookBackgrounds,
  bookIntros,
  commentaries,
  crossReferenceCount,
  document as findDocument,
  eventsAt,
  loadContext,
  module,
  topicsAt,
  type BookBackground,
} from '../lib/content';
import { fromId, refId, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { studiesCiting, traditionTitle, truncateText } from '../lib/studycontext';
import { useNearViewport } from '../lib/studycontext-hooks';
import { Disclosure, InlineError, RefChips } from '../lib/studycontext-ui';
import { Markdown } from '../components/Markdown';
import { Action, Card, Chip, Feature, Progress, Small, Wrap, message, useAsync } from '../components/ui';
import {
  openAtlas,
  openCommentaries,
  openConfessions,
  openContextCompare,
  openCrossReferences,
  openDocument,
  openGraph,
  openModels,
  openOriginal,
  openStudiesBrowser,
  openStudy,
  openTimeline,
  openTopic,
  openTopics,
  showPassage,
} from './open';

const TEXT = 'text-[17px] leading-relaxed';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-7">
      <h4 id={id} className="text-xl font-semibold leading-snug">
        {title}
      </h4>
      {children}
    </section>
  );
}

/** Indicador fino de carregamento de uma parte da tela. */
const Loading = ({ label }: { label: string }) => (
  <div className="my-3" role="status" aria-label={label}>
    <Progress />
  </div>
);

// ------------------------------------------------------------------ temas
function Themes({ r }: { r: Ref }) {
  const state = useAsync(() => topicsAt(r, 16), [refId(r)]);
  if (state.error) return <InlineError error={state.error} onRetry={state.reload} what={tr('Temas', 'Topics', 'Temas')} />;
  const themes = state.data ?? [];
  if (themes.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-[17px] font-medium">{tr('Temas ligados à passagem', 'Topics linked to the passage', 'Temas vinculados al pasaje')}</h4>
      <Wrap className="mt-2">
        {themes.map((topic) => (
          <Chip key={topic.id} onClick={() => openTopic(topic.id, topic.title)}>
            {topic.title}
          </Chip>
        ))}
      </Wrap>
    </div>
  );
}

// ------------------------------------------------------- recursos do trecho
const countLabel = (state: { data: number | undefined; error: unknown }) => (state.error ? '—' : state.data ?? '…');

function CrossReferencesFeature({ r }: { r: Ref }) {
  const state = useAsync(() => crossReferenceCount(r), [refId(r)]);
  return (
    <Feature
      title={tr('Referências cruzadas', 'Cross references', 'Referencias cruzadas')}
      subtitle={`${countLabel(state)} ${tr('ligações diretas · passagens com prévia e fonte', 'direct links · passages with preview and source', 'enlaces directos · pasajes con vista previa y fuente')}`}
      icon={Waypoints}
      onClick={() => openCrossReferences(r)}
    />
  );
}

function CommentariesFeature({ r, translation }: { r: Ref; translation: string }) {
  const state = useAsync(() => commentaries(r, { sourceTranslation: translation }).then((list) => list.length), [refId(r), translation]);
  return (
    <Feature
      title={t('commentaries')}
      subtitle={`${countLabel(state)} ${tr('entradas para a passagem · autores e intervalos identificados', 'entries for the passage · authors and ranges identified', 'entradas para el pasaje · autores e intervalos identificados')}`}
      icon={MessageSquare}
      onClick={() => openCommentaries(r)}
    />
  );
}

// --------------------------------------------- contexto histórico e literário
function Background({ r }: { r: Ref }) {
  const state = useAsync(() => bookBackgrounds().then((list) => list.find((b) => b.book === r.book) ?? null), [r.book]);
  const refs = useMemo(
    () => (state.data?.references ?? []).map((id) => fromId(id)).filter((x): x is Ref => x !== null),
    [state.data],
  );
  if (state.error) return <InlineError error={state.error} onRetry={state.reload} what={tr('Panorama do livro', 'Book overview', 'Panorama del libro')} />;
  if (state.data === undefined) return <Loading label={tr('Carregando panorama do livro', 'Loading book overview', 'Cargando panorama del libro')} />;
  const b = state.data as (BookBackground & { source?: string }) | null;
  if (!b) return null;
  return (
    <div className="mt-2">
      <span className="inline-flex min-h-[32px] items-center rounded-lg border border-outline px-3 py-1 text-sm">
        {b.genre} · {tr('panorama do livro', 'book overview', 'panorama del libro')}
      </span>
      <Markdown text={b.body} className={`mt-2 ${TEXT}`} />
      {b.chronology && <Small className="mt-2">{b.chronology}</Small>}
      {b.source && <Small className="mt-1">{b.source}</Small>}
      <RefChips refs={refs} sourceEdition="BLN4" className="mt-3" />
    </div>
  );
}

function ClassicCommentary({ r, translation }: { r: Ref; translation: string }) {
  const state = useAsync(
    () => commentaries(r, { moduleId: 'MHCC', sourceTranslation: translation }).then((list) => list[0] ?? null),
    [refId(r), translation],
  );
  const body = state.data?.pt?.body ?? '';
  const excerpt = useMemo(() => truncateText(body, 1800), [body]);
  if (state.error) return <InlineError error={state.error} onRetry={state.reload} what="Matthew Henry" />;
  if (!body.trim()) return null;
  return (
    <Disclosure
      defaultOpen
      title={tr('Contexto literário do trecho', 'Literary context of the passage', 'Contexto literario del pasaje')}
      subtitle={tr('Comentário clássico de Matthew Henry · leitura da passagem', "Matthew Henry's classic commentary · reading of the passage", 'Comentario clásico de Matthew Henry · lectura del pasaje')}
    >
      <Markdown text={excerpt} className={TEXT} />
      <div className="mt-2">
        <Action
          label={tr('Ler comentário completo e fontes', 'Read the full commentary and sources', 'Leer el comentario completo y las fuentes')}
          icon={FileText}
          onClick={() => openCommentaries(r, tr('Comentário da passagem', 'Commentary on the passage', 'Comentario del pasaje'))}
        />
      </div>
    </Disclosure>
  );
}

function Events({ r }: { r: Ref }) {
  const state = useAsync(() => loadContext().then((data) => eventsAt(data, r)), [refId(r)]);
  if (state.error) return <InlineError error={state.error} onRetry={state.reload} what={t('context')} />;
  if (state.data === undefined) return <Loading label={tr('Carregando eventos históricos', 'Loading historical events', 'Cargando eventos históricos')} />;
  if (state.data.length === 0) {
    return (
      <p className="py-3 text-[15.5px]">
        {tr(
          'Não há evento individual datado para esta passagem. O panorama do livro acima fornece o contexto disponível.',
          'There is no individually dated event for this passage. The book overview above provides the available context.',
          'No hay un evento individual fechado para este pasaje. El panorama del libro arriba ofrece el contexto disponible.',
        )}
      </p>
    );
  }
  return (
    <>
      {state.data.map((event) => (
        <Card key={event.id} className="mt-3 p-4">
          <h5 className="text-[17px] font-medium leading-snug">{event.title}</h5>
          <p className="mt-0.5 text-sm text-muted">
            {event.certainty} · {tr('associação pela perícope', 'association by pericope', 'asociación por perícopa')}
          </p>
          <Markdown text={event.description} className={`mt-2 ${TEXT}`} />
          <div className="mt-1">
            <Action label={tr('Ver na cronologia', 'View in the timeline', 'Ver en la cronología')} icon={CalendarClock} onClick={() => openTimeline(r)} />
          </div>
        </Card>
      ))}
    </>
  );
}

function BookIntros({ book }: { book: number }) {
  const intros = bookIntros(book);
  const busy = useRef(false);
  const open = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const doc = await findDocument(id);
      if (doc) openDocument(doc);
      else message(t('noContent'));
    } catch (error) {
      message(error instanceof Error ? error.message : String(error));
    } finally {
      busy.current = false;
    }
  };
  if (intros.length === 0) return null;
  return (
    <div className="mt-3">
      {intros.map((intro) => (
        <Feature
          key={intro.id}
          title={intro.title}
          subtitle={`${tr('Introdução ao livro', 'Book introduction', 'Introducción al libro')} · ${module(intro.module)?.author ?? ''}`}
          icon={FileText}
          onClick={() => void open(intro.id)}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------ teologia e diálogo
function CitingStudies({ r }: { r: Ref }) {
  const [anchor, near] = useNearViewport<HTMLDivElement>();
  const state = useAsync(
    () => (near ? allStudies().then((all) => studiesCiting(all, r)) : Promise.resolve(undefined)),
    [near, refId(r)],
  );
  const data = state.data;
  return (
    <div ref={anchor} className="min-h-[1px]">
      {state.error ? (
        <InlineError error={state.error} onRetry={state.reload} what={t('studies')} />
      ) : !data ? (
        near && <Loading label={tr('Carregando estudos', 'Loading studies', 'Cargando estudios')} />
      ) : data.items.length > 0 ? (
        <>
          <h5 className="mb-1.5 mt-3 text-[15px] font-medium">
            {data.direct
              ? tr('Estudos que citam este versículo', 'Studies citing this verse', 'Estudios que citan este versículo')
              : tr('Estudos que citam o livro · associação temática ampla', 'Studies citing the book · broad thematic association', 'Estudios que citan el libro · asociación temática amplia')}
          </h5>
          {data.items.map((study) => (
            <Feature
              key={study.id}
              title={study.title}
              subtitle={`${traditionTitle(study.target)} · ${tr('estudo com fontes', 'study with sources', 'estudio con fuentes')}`}
              icon={GraduationCap}
              onClick={() => openStudy(study, true)}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------- página
export default function VerseStudyPage({ reference }: { reference: Ref }) {
  useApp();
  const r = reference;
  const language = lang();
  const translation = app.translation;
  return (
    <div className="mx-auto max-w-3xl p-5">
      <h3 className="text-2xl font-normal leading-snug">{refLabel(r, language)}</h3>
      <Themes r={r} />
      <div className="mt-2">
        <Action label={tr('Explorar todos os temas', 'Explore all topics', 'Explorar todos los temas')} icon={Tag} onClick={() => openTopics(r)} />
      </div>
      <Wrap className="mt-1">
        <Action label={tr('Ler no contexto', 'Read in context', 'Leer en contexto')} icon={BookOpen} onClick={() => showPassage(r)} />
        <Action label={tr('Rede de conexões', 'Connection network', 'Red de conexiones')} icon={Network} onClick={() => openGraph(r)} />
      </Wrap>
      <div className="mt-3">
        <CrossReferencesFeature r={r} />
        <CommentariesFeature r={r} translation={translation} />
        <Feature
          title={t('original')}
          subtitle={tr('Lema, morfologia, glosa em português e outras ocorrências', 'Lemma, morphology, Portuguese gloss and other occurrences', 'Lema, morfología, glosa en portugués y otras ocurrencias')}
          icon={Languages}
          onClick={() => openOriginal(r)}
        />
        <Feature
          title={tr('Modelos 3D', '3D models', 'Modelos 3D')}
          subtitle={tr('Reconstruções, objetos e imagens literárias do trecho', 'Reconstructions, objects and literary images of the passage', 'Reconstrucciones, objetos e imágenes literarias del pasaje')}
          icon={Box}
          onClick={() => openModels(r)}
        />
      </div>

      <Section title={tr('Contexto histórico e literário', 'Historical and literary context', 'Contexto histórico y literario')}>
        <Background r={r} />
        <ClassicCommentary r={r} translation={translation} />
        <Events r={r} />
        <BookIntros book={r.book} />
        <div className="mt-3">
          <Feature
            title={tr('Mapas históricos', 'Historical maps', 'Mapas históricos')}
            subtitle={tr('Lugares e rotas cadastrados, com incertezas indicadas', 'Recorded places and routes, with uncertainties noted', 'Lugares y rutas registrados, con incertidumbres indicadas')}
            icon={MapIcon}
            onClick={() => openAtlas()}
          />
          <Feature
            title={tr('Comparar contextos', 'Compare contexts', 'Comparar contextos')}
            subtitle={tr('Escolha por testamento, livro, capítulo, versículo ou acontecimento', 'Choose by testament, book, chapter, verse or event', 'Elija por testamento, libro, capítulo, versículo o acontecimiento')}
            icon={ArrowLeftRight}
            onClick={() => openContextCompare(r)}
          />
        </div>
      </Section>

      <Section title={tr('Teologia e diálogo', 'Theology and dialogue', 'Teología y diálogo')}>
        <div className="mt-3">
          <Feature
            title={t('confessions')}
            subtitle={tr('Confissão de Fé, Breve Catecismo e Catecismo Maior', 'Confession of Faith, Shorter Catechism and Larger Catechism', 'Confesión de Fe, Catecismo Menor y Catecismo Mayor')}
            icon={LibraryBig}
            onClick={() => openConfessions()}
          />
        </div>
        <CitingStudies r={r} />
        <div className="mt-2">
          <Feature
            title={tr('Conhecer outras tradições', 'Learn about other traditions', 'Conocer otras tradiciones')}
            subtitle={tr('Exposição pela perspectiva de cada tradição e suas fontes', "Exposition from each tradition's perspective and its sources", 'Exposición desde la perspectiva de cada tradición y sus fuentes')}
            icon={Globe}
            onClick={() => openStudiesBrowser(false)}
          />
          <Feature
            title={tr('Defesa presbiteriana', 'Presbyterian defense', 'Defensa presbiteriana')}
            subtitle={tr('Argumentos, objeção mais forte e resposta do interlocutor', "Arguments, strongest objection and the interlocutor's response", 'Argumentos, objeción más fuerte y respuesta del interlocutor')}
            icon={MessagesSquare}
            onClick={() => openStudiesBrowser(true)}
          />
        </div>
      </Section>

    </div>
  );
}
