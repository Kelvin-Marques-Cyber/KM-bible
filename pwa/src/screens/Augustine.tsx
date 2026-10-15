// Confissões de Santo Agostinho (AugustineConfessionsPage de lib/agostinho.dart):
// texto integral por livro e capítulo, títulos, notas da edição, marcação de
// leitura, cópia com créditos, fonte maior, Anterior/Próximo entre livros e a
// posição lembrada (agostinho_livro / agostinho_capitulo, base 0).
import { ALargeSmall, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Copy } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/app';
import { augustineAvailable, augustineBook, augustineManifest, type AugustineChapter, type AugustineManifest } from '../lib/content';
import { t, tr } from '../lib/i18n';
import { pref, setPref } from '../lib/store';
import { scrollToTop } from '../lib/studies-hooks';
import {
  AUGUSTINE_EDITION_URL,
  augustineBookmarkKey,
  augustineCopyText,
  augustineCredits,
  clampPosition,
  footnotePieces,
  paragraphs as splitParagraphs,
  stepPosition,
  validAugustineCounts,
} from '../lib/studies-logic';
import { AugustineUnavailable, ExternalLink } from '../lib/studies-ui';
import { Button, Divider, Select, Small, Spinner, Wrap, copyText, message, useAsync } from '../components/ui';

/** Tamanho inicial e ciclo de "Fonte maior" (19 → 31 → 19), como no original. */
const BASE_SIZE = 19;
const nextSize = (size: number) => (size < 30 ? size + 2 : BASE_SIZE);

export default function AugustinePage({ initialBook, initialChapter }: { initialBook?: number; initialChapter?: number }) {
  useApp();
  // Sem o pacote integral neste build: índice dos livros e a edição externa.
  if (!augustineAvailable()) return <AugustineUnavailable />;
  return <AugustineManifestGate initialBook={initialBook} initialChapter={initialChapter} />;
}

function Failure({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-reading p-5">
      <p role="alert" className="select-text text-[15px]">
        {text}
      </p>
      {onRetry && (
        <Button variant="text" className="mt-2" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function AugustineManifestGate({ initialBook, initialChapter }: { initialBook?: number; initialChapter?: number }) {
  const manifest = useAsync(() => augustineManifest(), []);
  if (manifest.error) {
    return (
      <Failure
        text={`${tr('Edição integral ausente deste build. ', 'Full edition missing from this build. ', 'Edición íntegra ausente de esta versión. ')}${errorText(manifest.error)}`}
        onRetry={manifest.reload}
      />
    );
  }
  if (manifest.data === undefined) return <Spinner />;
  const meta = manifest.data;
  if (!meta || !validAugustineCounts(meta.chapterCounts, meta.chapterCount)) {
    return <Failure text={tr('Índice integral inválido.', 'Invalid full index.', 'Índice íntegro no válido.')} />;
  }
  return <AugustineReader meta={meta} counts={meta.chapterCounts} initialBook={initialBook} initialChapter={initialChapter} />;
}

const savedNumber = (key: string) => {
  const value = pref<unknown>(key, 0);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

function AugustineReader({
  meta,
  counts,
  initialBook,
  initialChapter,
}: {
  meta: AugustineManifest;
  counts: number[];
  initialBook?: number;
  initialChapter?: number;
}) {
  // Como no original: a posição pedida tem prioridade; o que faltar vem da posição gravada.
  const [bookIndex, setBookIndex] = useState<number | undefined>(initialBook);
  const [chapterIndex, setChapterIndex] = useState<number | undefined>(initialChapter);
  const [size, setSize] = useState(BASE_SIZE);
  const top = useRef<HTMLElement>(null);
  const [b, c] = clampPosition(counts, bookIndex ?? savedNumber('agostinho_livro'), chapterIndex ?? savedNumber('agostinho_capitulo'));
  const book = useAsync(() => augustineBook(b + 1), [b]);

  // A posição exibida fica gravada (base 0), também quando aberta por um índice.
  useEffect(() => {
    if (pref<unknown>('agostinho_livro', null) !== b) void setPref('agostinho_livro', b, false);
    if (pref<unknown>('agostinho_capitulo', null) !== c) void setPref('agostinho_capitulo', c, false);
  }, [b, c]);

  // Perto do fim de um livro, o próximo é baixado em segundo plano (≈ 60 KB).
  useEffect(() => {
    if (b + 1 >= counts.length || c < counts[b] - 2) return;
    const id = setTimeout(() => void augustineBook(b + 2).catch(() => undefined), 1200);
    return () => clearTimeout(id);
  }, [b, c, counts]);

  const select = (nb: number, nc: number) => {
    setBookIndex(nb);
    setChapterIndex(nc);
    scrollToTop(top.current);
  };
  const previous = stepPosition(counts, b, c, -1);
  const next = stepPosition(counts, b, c, 1);

  const bookmark = augustineBookmarkKey(b, c);
  const marked = pref<unknown>(bookmark, false) === true;
  const label = (n: number) => `${tr('Livro', 'Book', 'Libro')} ${n}`;
  const chapterLabel = (n: number) => `${tr('Capítulo', 'Chapter', 'Capítulo')} ${n}`;

  // Logo após trocar de livro, os dados ainda podem ser do livro anterior.
  const current = book.data && Number(book.data.book) === b + 1 ? book.data : undefined;
  const entries = current?.chapters;
  const complete = Array.isArray(entries) && entries.length === counts[b];
  const chapter = complete ? entries[c] : undefined;

  return (
    <article ref={top} className="mx-auto max-w-reading px-[18px] pb-8 pt-3" aria-label={tr('Confissões de Santo Agostinho', "Saint Augustine's Confessions", 'Confesiones de San Agustín')}>
      <h3 className="text-2xl font-normal leading-snug">{tr('Confissões de Santo Agostinho', "Saint Augustine's Confessions", 'Confesiones de San Agustín')}</h3>
      <p className="mt-1.5 text-[15px]">
        {tr(
          'Texto integral em português. Leitura offline, sem resumos.',
          'Full text in Portuguese. Offline reading, without summaries.',
          'Texto íntegro en portugués. Lectura sin conexión, sin resúmenes.',
        )}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Select
          label={tr('Livro', 'Book', 'Libro')}
          value={String(b)}
          onChange={(e) => select(Number(e.target.value), 0)}
          options={counts.map((_, i) => ({ value: String(i), label: label(i + 1) }))}
        />
        <Select
          label={tr('Capítulo', 'Chapter', 'Capítulo')}
          value={String(c)}
          onChange={(e) => select(b, Number(e.target.value))}
          options={Array.from({ length: counts[b] }, (_, i) => ({ value: String(i), label: chapterLabel(i + 1) }))}
        />
      </div>
      <h4 className="mt-5 text-[22px] font-normal leading-snug" aria-live="polite">
        {label(b + 1)} · {chapterLabel(c + 1)}
      </h4>

      {book.error ? (
        <Failure text={`${tr('Não foi possível ler o livro: ', 'Could not read the book: ', 'No se pudo leer el libro: ')}${errorText(book.error)}`} onRetry={book.reload} />
      ) : book.data === undefined || book.loading || (book.data !== null && !current) ? (
        <Spinner />
      ) : !chapter ? (
        <Failure text={tr('Livro incompleto.', 'Incomplete book.', 'Libro incompleto.')} />
      ) : (
        <ChapterText key={`${b}:${c}`} chapter={chapter} size={size} />
      )}

      <Wrap className="mt-5 gap-1">
        <Button variant="text" icon={marked ? BookmarkCheck : Bookmark} aria-pressed={marked} className="px-3" onClick={() => void setPref(bookmark, !marked)}>
          {marked ? tr('Marcado', 'Marked', 'Marcado') : tr('Marcar leitura', 'Mark reading', 'Marcar lectura')}
        </Button>
        <Button
          variant="text"
          icon={Copy}
          className="px-3"
          disabled={!chapter}
          onClick={async () => {
            if (!chapter) return;
            const ok = await copyText(augustineCopyText(b, c, chapter.body));
            message(ok ? tr('Capítulo copiado com os créditos.', 'Chapter copied with credits.', 'Capítulo copiado con los créditos.') : t('error'));
          }}
        >
          {tr('Copiar capítulo', 'Copy chapter', 'Copiar capítulo')}
        </Button>
        <Button
          variant="text"
          icon={ALargeSmall}
          className="px-3"
          title={`${size}px`}
          onClick={() => setSize(nextSize)}
        >
          {tr('Fonte maior', 'Larger font', 'Letra más grande')}
        </Button>
      </Wrap>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outlined" icon={ArrowLeft} disabled={!previous} onClick={() => previous && select(previous[0], previous[1])}>
          {t('previous')}
        </Button>
        <Button icon={ArrowRight} disabled={!next} onClick={() => next && select(next[0], next[1])}>
          {t('next')}
        </Button>
      </div>
      <Divider className="my-6" />
      <Small className="select-text whitespace-pre-line [overflow-wrap:anywhere]">{augustineCredits(meta)}</Small>
      <ExternalLink href={AUGUSTINE_EDITION_URL} className="-ml-3 mt-1">
        {tr('Conferir edição e créditos', 'Check the edition and credits', 'Consultar la edición y los créditos')}
      </ExternalLink>
    </article>
  );
}

/** Título, parágrafos (linhas em branco) e notas da edição de um capítulo. */
const ChapterText = memo(function ChapterText({ chapter, size }: { chapter: AugustineChapter; size: number }) {
  const notes = useMemo(() => (Array.isArray(chapter.footnotes) ? chapter.footnotes : []), [chapter]);
  const numbers = useMemo(() => new Set(notes.map((n) => Number(n.number)).filter(Number.isFinite)), [notes]);
  const blocks = useMemo(() => splitParagraphs(String(chapter.body ?? '')).map((p) => footnotePieces(p, numbers)), [chapter, numbers]);
  const title = String(chapter.title ?? '').trim();
  return (
    <>
      {title && <h5 className="mt-3.5 select-text font-reading text-[22px] font-semibold leading-[1.35]">{title}</h5>}
      <div className="mt-5 select-text font-reading" style={{ fontSize: size, lineHeight: 1.78 }}>
        {blocks.map((pieces, i) => (
          <p key={i} className={i > 0 ? (i > 5 ? 'cv-auto mt-[1em] whitespace-pre-line' : 'mt-[1em] whitespace-pre-line') : 'whitespace-pre-line'}>
            {pieces.map((piece, j) =>
              piece.note ? (
                <sup key={j} className="text-primary">
                  {piece.text}
                </sup>
              ) : (
                <span key={j}>{piece.text}</span>
              ),
            )}
          </p>
        ))}
      </div>
      {notes.length > 0 && (
        <section aria-label={tr('Notas da edição', 'Edition notes', 'Notas de la edición')}>
          <Divider className="my-8" />
          <h5 className="text-[17px] font-semibold">{tr('Notas da edição', 'Edition notes', 'Notas de la edición')}</h5>
          <ol className="mt-2.5 list-none">
            {notes.map((note, i) => (
              <li key={`${note.number}:${i}`} className={`mb-3 select-text font-reading [overflow-wrap:anywhere] ${i > 12 ? 'cv-auto' : ''}`} style={{ fontSize: size - 3, lineHeight: 1.5 }}>
                {`${note.number}. ${note.text}`}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
});
