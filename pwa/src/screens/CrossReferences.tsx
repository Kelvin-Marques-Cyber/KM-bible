// CrossReferencesPage de lib/cross_references.dart: relações curadas (nos dois
// sentidos) + referências cruzadas do OpenBible/TSK, filtros por tipo, prévia
// na Bíblia Livre (carregada só quando o cartão chega perto da tela).
import { BookOpen, Network } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/app';
import { catalog, packUrl } from '../lib/catalog';
import { bibleBook, crossReferenceCount, crossReferences, relations, type BookData } from '../lib/content';
import { fetchJson } from '../lib/fetcher';
import { fromId, refId, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import {
  XREF_FILTERS,
  curatedRows,
  filterXrefs,
  relationLabel,
  stableKeys,
  verseText,
  xrefTitle,
  type Relation,
  type XrefFilter,
  type XrefRow,
} from '../lib/commentaries-logic';
import { Action, Button, Chip, Divider, ErrorBox, Heading, Small, Spinner, Wrap, useAsync } from '../components/ui';
import { openGraph, showPassage } from './open';

const PREVIEW_EDITION = 'BLN4';
const STEP = 20;

const filterLabels: Record<XrefFilter, [string, string, string]> = {
  all: ['Todos', 'All', 'Todos'],
  textual: ['Citações', 'Quotations', 'Citas'],
  editorial: ['Temas relacionados', 'Related themes', 'Temas relacionados'],
  theological: ['Teologia', 'Theology', 'Teología'],
};

type BookLoader = (book: number) => Promise<BookData | null>;

/**
 * Relações curadas. content.misc() guarda a promessa mesmo quando ela falha;
 * por isso uma falha anterior é refeita diretamente pelo fetcher (que não
 * memoriza erros). Sem relações, as demais referências continuam visíveis.
 */
const loadRelations = (): Promise<Relation[]> =>
  relations()
    .catch(() => fetchJson<Relation[]>(packUrl(catalog.misc, 'relations.json')))
    .catch(() => []);

/** Contêiner com rolagem (folha ou painel usam .scroll-area), para a margem de pré-carga valer. */
const scrollParent = (node: HTMLElement): Element | null => node.parentElement?.closest('.scroll-area') ?? null;

/** Texto da Bíblia Livre para o alvo; só busca o livro quando o cartão se aproxima da tela. */
function usePreview(target: Ref, load: BookLoader) {
  const element = useRef<HTMLElement>(null);
  const [text, setText] = useState<string | null | undefined>(undefined);
  const id = refId(target);
  useEffect(() => {
    let alive = true;
    const run = () =>
      load(target.book).then(
        (book) => alive && setText(verseText(book, target)),
        () => alive && setText(null),
      );
    const node = element.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      void run();
      return () => {
        alive = false;
      };
    }
    // Sem root explícito, a margem só valeria para a janela: dentro da folha
    // (overflow: auto) o cartão é recortado e só carregaria ao aparecer.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void run();
        }
      },
      { root: scrollParent(node), rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => {
      alive = false;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, load]);
  return { element, text };
}

const XrefCard = memo(function XrefCard({ row, language, load }: { row: XrefRow; language: string; load: BookLoader }) {
  const target = fromId(row.target)!;
  const end = fromId(row.end_reference) ?? target;
  const { element, text } = usePreview(target, load);
  return (
    <article ref={element} className="cv-auto mb-3 rounded-2xl bg-surface-low p-[15px] shadow-sm ring-1 ring-outline/30" style={{ containIntrinsicSize: 'auto 220px' }}>
      <h3 className="text-[16.5px] font-medium leading-snug">{xrefTitle(target, end, language)}</h3>
      <p className="text-[13px] font-medium tracking-wide text-primary">{relationLabel(row.kind, language)}</p>
      {row.scope === 'chapter' && (
        <p className="mt-1 text-[15px]">
          {tr(
            'Relação do capítulo: não há ligação específica cadastrada para este versículo.',
            'Chapter relation: there is no specific link recorded for this verse.',
            'Relación del capítulo: no hay un vínculo específico registrado para este versículo.',
          )}
        </p>
      )}
      {text && (
        <p
          className="my-2.5 font-reading text-[16px] leading-relaxed"
          style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {text}
        </p>
      )}
      <Wrap className="gap-x-1 gap-y-0">
        <Action
          label={tr('Ler no contexto', 'Read in context', 'Leer en contexto')}
          icon={BookOpen}
          onClick={() => showPassage(target, { end, sourceEdition: PREVIEW_EDITION })}
        />
        <Action label={tr('Ver conexões', 'See connections', 'Ver conexiones')} icon={Network} onClick={() => openGraph(target)} />
      </Wrap>
      {row.provenance && <Small className="break-words">{row.provenance}</Small>}
    </article>
  );
});

export default function CrossReferencesPage({ reference }: { reference: Ref }) {
  // Filtro, limite e livros carregados recomeçam quando a passagem muda.
  return <CrossReferencesView key={refId(reference)} reference={reference} />;
}

function CrossReferencesView({ reference }: { reference: Ref }) {
  useApp();
  const language = lang();
  const id = refId(reference);
  const [filter, setFilter] = useState<XrefFilter>('all');
  const [limit, setLimit] = useState(STEP);

  // Relações curadas: falha (ex.: sem conexão) não impede as demais referências.
  const curated = useAsync(loadRelations, []);
  const state = useAsync(async () => {
    const [rows, count] = await Promise.all([crossReferences(reference, limit), crossReferenceCount(reference)]);
    return { rows, count };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, limit]);

  // Um pedido por livro da Bíblia Livre, compartilhado pelos cartões desta tela.
  const books = useRef(new Map<number, Promise<BookData | null>>());
  const load = useCallback<BookLoader>((book) => {
    let p = books.current.get(book);
    if (!p) {
      p = bibleBook(PREVIEW_EDITION, book);
      p.catch(() => books.current.delete(book));
      books.current.set(book, p);
    }
    return p;
  }, []);

  const rows = useMemo(
    () => [...curatedRows(curated.data ?? [], id), ...(state.data?.rows ?? [])],
    [curated.data, id, state.data],
  );
  const shown = useMemo(() => filterXrefs(rows, filter), [rows, filter]);
  // Chaves estáveis: trocar o filtro ou mostrar mais não remonta cartões já carregados.
  const keys = useMemo(() => stableKeys(shown, (row) => `${row.kind}|${row.scope}|${row.target}|${row.end_reference}|${row.provenance}`), [shown]);
  const count = state.data?.count ?? 0;

  return (
    <div className="mx-auto max-w-3xl p-5">
      <Heading>{refLabel(reference, language)}</Heading>
      <Small>
        {state.data
          ? tr(`${count} referências diretas cadastradas`, `${count} direct references recorded`, `${count} referencias directas registradas`)
          : t('loading')}
      </Small>
      <div className="mt-3">
        <Action
          label={tr('Explorar a rede desta passagem', 'Explore this passage’s network', 'Explorar la red de este pasaje')}
          icon={Network}
          onClick={() => openGraph(reference)}
        />
      </div>
      <Wrap className="mt-1">
        {XREF_FILTERS.map((f) => {
          const [pt, en, es] = filterLabels[f];
          return (
            <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
              {tr(pt, en, es)}
            </Chip>
          );
        })}
      </Wrap>
      <div role="status" aria-live="polite" className="sr-only">
        {state.loading ? t('loading') : tr(`${shown.length} referências exibidas`, `${shown.length} references shown`, `${shown.length} referencias mostradas`)}
      </div>
      <div className="mt-3">
        {state.error ? (
          <ErrorBox error={state.error} onRetry={state.reload} />
        ) : state.data === undefined || curated.data === undefined ? (
          <Spinner />
        ) : (
          <>
            {shown.map((row, index) => (
              <XrefCard key={keys[index]} row={row} language={language} load={load} />
            ))}
            {shown.length === 0 && (
              <p className="py-2 text-[15px]">
                {tr(
                  'Não há referências neste filtro. Veja o contexto do capítulo ou outro tipo de ligação.',
                  'There are no references for this filter. See the chapter context or another kind of link.',
                  'No hay referencias en este filtro. Vea el contexto del capítulo u otro tipo de vínculo.',
                )}
              </p>
            )}
            {count > limit && (
              <Button variant="text" disabled={state.loading} onClick={() => setLimit((n) => n + STEP)}>
                {state.loading ? t('loading') : tr('Mostrar mais referências', 'Show more references', 'Mostrar más referencias')}
              </Button>
            )}
          </>
        )}
      </div>
      <Divider className="my-7" />
      <Small>
        {tr(
          'OpenBible.info / Treasury of Scripture Knowledge · CC BY 4.0. Base de endereços KJV; a leitura acima usa Bíblia Livre. Confira possíveis diferenças de numeração ao comparar edições.',
          'OpenBible.info / Treasury of Scripture Knowledge · CC BY 4.0. KJV address basis; the previews above use the Bíblia Livre. Check possible numbering differences when comparing editions.',
          'OpenBible.info / Treasury of Scripture Knowledge · CC BY 4.0. Base de direcciones KJV; la lectura de arriba usa la Bíblia Livre. Verifique posibles diferencias de numeración al comparar ediciones.',
        )}
      </Small>
    </div>
  );
}
