// Progresso explícito da leitura, independente da tradução. Não se confunde
// com posição de rolagem, histórico de navegação ou progresso de estudos.
import { catalog } from './catalog';
import { completedMany, isCompleted } from './store';

export interface BookReading {
  book: number;
  chapters: number[];
  read: number;
  total: number;
  complete: boolean;
  percent: number;
}

const canon = catalog.bibles.BLN4 ?? Object.values(catalog.bibles)
  .slice().sort((a, b) => Object.keys(b.chapters).length - Object.keys(a.chapters).length)[0];

export function chaptersOf(book: number): number[] {
  return (canon?.chapters[String(book)] ?? []).flatMap((verses, index) => verses > 0 ? [index + 1] : []);
}

export function chapterReadingId(book: number, chapter: number): string {
  if (!Number.isInteger(book) || !Number.isInteger(chapter) || !chaptersOf(book).includes(chapter)) throw new RangeError('Capítulo inválido');
  return `bible:chapter:${book}:${chapter}`;
}

export function chapterRead(book: number, chapter: number): boolean {
  return isCompleted(chapterReadingId(book, chapter));
}

export async function markChapter(book: number, chapter: number, read: boolean): Promise<void> {
  await completedMany([chapterReadingId(book, chapter)], read);
}

export async function markBook(book: number, read: boolean): Promise<void> {
  const chapters = chaptersOf(book);
  if (!chapters.length) throw new RangeError('Livro inválido');
  await completedMany(chapters.map((chapter) => chapterReadingId(book, chapter)), read);
}

export function bookReading(book: number): BookReading {
  const chapters = chaptersOf(book);
  const read = chapters.filter((chapter) => chapterRead(book, chapter)).length;
  return { book, chapters, read, total: chapters.length, complete: chapters.length > 0 && read === chapters.length,
    percent: chapters.length ? Math.floor(read / chapters.length * 1000) / 10 : 0 };
}

export function bibleReading(testament: 0 | 1 | 2 = 0) {
  const books = Array.from({ length: 66 }, (_, i) => i + 1)
    .filter((book) => testament === 0 || (testament === 1 ? book <= 39 : book >= 40))
    .map(bookReading).filter((book) => book.total > 0);
  const read = books.reduce((n, book) => n + book.read, 0);
  const total = books.reduce((n, book) => n + book.total, 0);
  return { books, read, total, complete: books.filter((book) => book.complete).length,
    percent: total ? Math.floor(read / total * 1000) / 10 : 0 };
}
