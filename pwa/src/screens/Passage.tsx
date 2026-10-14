// PassagePicker (lib/passage_picker.dart) e showPassage (lib/common.dart).
import { ArrowLeft, BookOpen, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { app, closeSheet, fontSize, lineHeight, navigate } from '../lib/app';
import { availableBooks, chapterCount, hasVerse, mapped, verses, type VerseRow } from '../lib/content';
import { bookNames, parseRef, ref, refKey, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { Async, Button, Chip, Field, Heading, ListItem, Small, Wrap, useAsync } from '../components/ui';

export function PassagePicker({ onSelect, initial, edition: forced }: { onSelect?: (r: Ref) => void; initial?: Ref; edition?: string }) {
  const edition = forced ?? app.translation;
  const language = lang();
  const [testament, setTestament] = useState(0);
  const [book, setBook] = useState<number | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [typed, setTyped] = useState(initial ? refLabel(initial, language) : '');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const books = availableBooks(edition).filter((b) => testament === 0 || (testament === 1 ? b < 40 : b >= 40));
  const chapterVerses = useAsync(
    () => (book && chapter ? verses(edition, book, chapter) : Promise.resolve([] as VerseRow[])),
    [edition, book, chapter],
  );

  const select = (r: Ref) => {
    if (!hasVerse(edition, r)) {
      setError(t('noContent'));
      return;
    }
    closeSheet();
    if (onSelect) onSelect(r);
    else navigate(r);
  };
  const manual = () => {
    const r = parseRef(typed);
    if (!r) setError(tr('Confira o livro, capítulo e versículo.', 'Check the book, chapter and verse.', 'Revise el libro, capítulo y versículo.'));
    else select(r);
  };

  return (
    <div className="mx-auto max-w-3xl p-5">
      <Heading>{tr('Escolha a passagem', 'Choose the passage', 'Elija el pasaje')}</Heading>
      <Wrap className="mt-3">
        {[
          [0, tr('Todos', 'All', 'Todos')],
          [1, tr('Antigo Testamento', 'Old Testament', 'Antiguo Testamento')],
          [2, tr('Novo Testamento', 'New Testament', 'Nuevo Testamento')],
        ].map(([value, label]) => (
          <Chip
            key={value}
            selected={testament === value}
            onClick={() => {
              setTestament(value as number);
              setBook(null);
              setChapter(null);
            }}
          >
            {label}
          </Chip>
        ))}
      </Wrap>
      <div className="mt-4 rounded-2xl ring-1 ring-outline/40">
        <button type="button" aria-expanded={typing} onClick={() => setTyping((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span>{tr('Digitar uma referência', 'Type a reference', 'Escribir una referencia')}</span>
          <ChevronDown size={20} aria-hidden className={typing ? 'rotate-180' : ''} />
        </button>
        {typing && (
          <form
            className="flex items-end gap-2 px-4 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              manual();
            }}
          >
            <Field label={t('reference')} placeholder="João 3:16 · Rm 8:28" value={typed} autoFocus onChange={(e) => setTyped(e.target.value)} className="flex-1" />
            <Button type="submit" icon={Check} aria-label={tr('Selecionar passagem', 'Select passage', 'Seleccionar pasaje')}>
              OK
            </Button>
          </form>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
      {book !== null && (
        <Wrap className="mt-4">
          <Chip
            icon={ArrowLeft}
            onClick={() => {
              setBook(null);
              setChapter(null);
            }}
          >
            {tr('Livros', 'Books', 'Libros')}
          </Chip>
          <Chip onClick={() => setChapter(null)}>{bookNames(language)[book - 1]}</Chip>
          {chapter !== null && <Chip selected>{tr('Capítulo', 'Chapter', 'Capítulo')} {chapter}</Chip>}
        </Wrap>
      )}
      {book === null ? (
        <ul className="mt-3 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {books.map((b) => (
            <li key={b}>
              <ListItem leading={BookOpen} title={bookNames(language)[b - 1]} trailing="chevron" onClick={() => setBook(b)} />
            </li>
          ))}
        </ul>
      ) : chapter === null ? (
        <>
          <p className="my-3.5">{tr('Capítulo', 'Chapter', 'Capítulo')}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
            {Array.from({ length: chapterCount(edition, book) }, (_, i) => i + 1).map((c) => (
              <Button key={c} variant="tonal" className="px-0" onClick={() => setChapter(c)}>
                {c}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="my-3.5">{tr('Versículo', 'Verse', 'Versículo')}</p>
          <Async state={chapterVerses}>
            {(rows) => (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
                {rows.map((v) => (
                  <Button key={v.verse} variant="tonal" className="px-0" onClick={() => select(ref(book, chapter, v.verse))}>
                    {v.verse}
                  </Button>
                ))}
              </div>
            )}
          </Async>
          <Button variant="text" icon={BookOpen} className="mt-3" onClick={() => select(ref(book, chapter, 1))}>
            {tr('Abrir o início do capítulo', 'Open the start of the chapter', 'Abrir el inicio del capítulo')}
          </Button>
        </>
      )}
    </div>
  );
}

interface Preview {
  edition: string;
  reference: Ref;
  rows: VerseRow[];
  explanation: string | null;
}

async function loadPreview(r: Ref, sourceEdition?: string, end?: Ref): Promise<Preview> {
  let edition = app.translation;
  let reference = r;
  let explanation: string | null = null;
  if (sourceEdition && sourceEdition !== edition) {
    const m = mapped(sourceEdition, r, edition);
    if (m && hasVerse(edition, m)) reference = m;
    else {
      edition = sourceEdition;
      explanation = tr(
        'A referência é apresentada na edição de origem. Não há mapeamento verificado para a edição selecionada.',
        'The reference is shown in the source edition. There is no verified mapping for the selected edition.',
      );
    }
  }
  const rangeEnd = end && end.book === reference.book && refKey(end) >= refKey(reference) ? end : null;
  const lastChapter = rangeEnd ? Math.min(Math.max(rangeEnd.chapter, reference.chapter), reference.chapter + 2) : reference.chapter;
  const rows: VerseRow[] = [];
  for (let chapter = reference.chapter; chapter <= lastChapter; chapter++) {
    for (const v of await verses(edition, reference.book, chapter)) {
      const key = refKey(ref(reference.book, chapter, v.verse));
      if (key >= refKey(reference) && (rangeEnd ? key <= refKey(rangeEnd) : v.verse <= reference.verse + 5)) rows.push(v);
    }
  }
  if (rangeEnd && (rangeEnd.chapter > lastChapter || rows.length > 120)) {
    explanation = `${explanation ?? ''}\n${tr('Prévia do intervalo. Abra a Bíblia para continuar a leitura completa.', 'Range preview. Open the Bible to continue reading.')}`.trim();
  }
  return { edition, reference, rows, explanation };
}

export function PassagePreview({ reference, sourceEdition, end }: { reference: Ref; sourceEdition?: string; end?: Ref }) {
  const state = useAsync(() => loadPreview(reference, sourceEdition, end), [reference, sourceEdition, end]);
  return (
    <div className="mx-auto max-w-reading p-5">
      <Async state={state}>
        {(p) => (
          <>
            <p className="text-sm font-semibold text-muted">{p.edition}</p>
            {p.explanation && <Small className="mt-1 whitespace-pre-line">{p.explanation}</Small>}
            <div className="mt-4 space-y-3">
              {p.rows.slice(0, 120).map((row) => (
                <p key={row.reference} className="select-text font-reading" style={{ fontSize: fontSize(), lineHeight: lineHeight() }}>
                  <span className="text-primary" style={{ fontSize: fontSize() * 0.65 }}>
                    {row.chapter}:{row.verse}
                  </span>{' '}
                  {row.text}
                </p>
              ))}
            </div>
            {p.rows.length === 0 && <p>{t('noContent')}</p>}
            <Button className="mt-5" icon={BookOpen} onClick={() => navigate(p.reference, { edition: p.edition })}>
              {t('bible')}
            </Button>
          </>
        )}
      </Async>
    </div>
  );
}
