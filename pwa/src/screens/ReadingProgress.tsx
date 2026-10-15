import { BookCheck, BookOpen, Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { app, navigate, useApp } from '../lib/app';
import { hasVerse } from '../lib/content';
import { bookNames, ref } from '../lib/domain';
import { lang, tr } from '../lib/i18n';
import { bibleReading, bookReading, chapterRead, markBook, markChapter } from '../lib/reading-progress';
import { Button, Card, Chip, Select, Wrap } from '../components/ui';

export default function ReadingProgressPage({ initialBook }: { initialBook?: number }) {
  useApp();
  const [book, setBook] = useState(initialBook ?? app.passage.book);
  const [testament, setTestament] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const all = bibleReading();
  const filtered = bibleReading(testament);
  const current = bookReading(book);
  const names = bookNames(lang());
  const run = async (job: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await job(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const read = (chapter: number) => {
    if (!navigate(ref(book, chapter), { edition: app.translation })) setError(tr('Este capítulo não está disponível nesta tradução. Escolha uma Bíblia completa no leitor.', 'This chapter is unavailable in this translation. Choose a complete Bible in the reader.', 'Este capítulo no está disponible en esta traducción.'));
  };
  return <div className="mx-auto max-w-3xl p-5">
    <h3 className="text-2xl font-normal">{tr('Minha leitura da Bíblia', 'My Bible reading', 'Mi lectura de la Biblia')}</h3>
    <p className="mb-4 mt-1 text-sm text-muted">{tr('Marque o que já leu. Seu progresso acompanha os capítulos em todas as traduções e permanece salvo sem internet.', 'Mark what you have read. Progress follows chapters across translations and stays saved offline.', 'Marque lo que ha leído. El progreso se conserva sin conexión entre traducciones.')}</p>
    <Card className="p-4">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-3xl font-normal">{all.percent.toLocaleString(lang())}%</p><p className="mt-1 text-sm text-muted">{all.read.toLocaleString(lang())} / {all.total.toLocaleString(lang())} {tr('capítulos lidos', 'chapters read', 'capítulos leídos')}</p></div>
        <p className="text-right text-sm">{all.complete} / {all.books.length}<br />{tr('livros completos', 'complete books', 'libros completos')}</p>
      </div>
      <progress aria-label={tr('Progresso da Bíblia', 'Bible progress', 'Progreso de la Biblia')} value={all.read} max={all.total || 1} className="reading-progress mt-3 w-full" />
    </Card>
    <section className="mt-5" aria-label={tr('Progresso por livro', 'Progress by book', 'Progreso por libro')}>
      <Select label={tr('Livro', 'Book', 'Libro')} value={String(book)} options={all.books.map((item) => ({ value: String(item.book), label: `${names[item.book - 1]} · ${item.read}/${item.total}` }))} onChange={(event) => setBook(Number(event.target.value))} />
      <div className="mt-4 flex items-center gap-2"><BookOpen size={22} aria-hidden className="text-primary" /><h4 className="text-xl">{names[book - 1]}</h4><span className="ml-auto text-sm text-muted">{current.read} / {current.total}</span></div>
      <Wrap className="mt-3">
        <Button icon={BookCheck} disabled={busy} onClick={() => void run(() => markBook(book, !current.complete))}>{current.complete ? tr('Marcar livro como não lido', 'Mark book unread', 'Marcar libro sin leer') : tr('Marcar livro como lido', 'Mark book read', 'Marcar libro leído')}</Button>
        <Button variant="outlined" icon={BookOpen} onClick={() => read(current.chapters.find((chapter) => !chapterRead(book, chapter)) ?? 1)}>{tr('Continuar leitura', 'Continue reading', 'Continuar lectura')}</Button>
      </Wrap>
      <p className="mb-3 mt-3 text-sm text-muted">{tr('Toque no número para ler; use a marca abaixo para registrar a leitura.', 'Tap a number to read; use the check below to record reading.', 'Toque el número para leer y la marca para registrar la lectura.')}</p>
      {error && <p role="alert" className="mb-3 text-danger">{error}</p>}
      <div aria-busy={busy} className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {current.chapters.map((chapter) => {
          const done = chapterRead(book, chapter);
          const label = `${names[book - 1]} ${chapter}`;
          return <div key={chapter} className={`overflow-hidden rounded-xl border ${done ? 'border-primary/40 bg-secondary-container' : 'border-outline/50 bg-surface'}`}>
            <button type="button" className="block min-h-11 w-full text-lg hover:bg-primary/10 disabled:opacity-40" aria-label={`${tr('Ler', 'Read', 'Leer')} ${label}`} disabled={!hasVerse(app.translation, ref(book, chapter))} onClick={() => read(chapter)}>{chapter}</button>
            <button type="button" aria-pressed={done} disabled={busy} aria-label={`${done ? tr('Marcar como não lido', 'Mark unread', 'Marcar sin leer') : tr('Marcar como lido', 'Mark read', 'Marcar leído')}: ${label}`} onClick={() => void run(() => markChapter(book, chapter, !done))} className="flex min-h-10 w-full items-center justify-center border-t border-outline/30 hover:bg-primary/10">
              {done ? <Check size={18} aria-hidden className="text-primary" /> : <span className="h-4 w-4 rounded-full border border-outline" aria-hidden />}
            </button>
          </div>;
        })}
      </div>
    </section>
    <section className="mt-6" aria-label={tr('Visão geral dos livros', 'Books overview', 'Resumen de libros')}>
      <h4 className="text-xl">{tr('Toda a Bíblia', 'The whole Bible', 'Toda la Biblia')}</h4>
      <Wrap className="my-3">{([0, 1, 2] as const).map((value) => <Chip key={value} selected={value === testament} onClick={() => setTestament(value)}>{value === 0 ? tr('Todos', 'All', 'Todos') : value === 1 ? tr('Antigo Testamento', 'Old Testament', 'Antiguo Testamento') : tr('Novo Testamento', 'New Testament', 'Nuevo Testamento')}</Chip>)}</Wrap>
      <p className="mb-2 text-sm text-muted">{filtered.read.toLocaleString(lang())} / {filtered.total.toLocaleString(lang())} {tr('capítulos lidos', 'chapters read', 'capítulos leídos')}</p>
      <ul className="grid gap-2 sm:grid-cols-2">{filtered.books.map((item) => <li key={item.book}><button type="button" onClick={() => setBook(item.book)} aria-current={item.book === book ? 'true' : undefined} className="flex w-full items-center gap-3 rounded-xl border border-outline/40 px-3 py-3 text-left hover:bg-primary/5">
        {item.complete ? <BookCheck size={21} aria-hidden className="text-primary" /> : <BookOpen size={21} aria-hidden className="text-muted" />}
        <span className="min-w-0 flex-1"><span className="block">{names[item.book - 1]}</span><span className="block text-xs text-muted">{item.read} / {item.total} · {item.percent.toLocaleString(lang())}%</span><progress value={item.read} max={item.total} aria-label={names[item.book - 1]} className="reading-progress mt-1 block h-1 w-full" /></span><ChevronRight size={16} aria-hidden className="text-muted" />
      </button></li>)}</ul>
    </section>
  </div>;
}
