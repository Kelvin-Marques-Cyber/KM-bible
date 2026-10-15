import { beforeEach, expect, it } from 'vitest';
import { getAll, put, write } from '../../src/lib/db';
import { completed, isCompleted, loadProgress } from '../../src/lib/store';
import { bibleReading, bookReading, chapterRead, chapterReadingId, markBook, markChapter } from '../../src/lib/reading-progress';

beforeEach(async () => {
  await write(['learning_progress'], (tx) => { tx.objectStore('learning_progress').clear(); });
  await loadProgress();
});

it('usa os 66 livros e 1189 capítulos do acervo canônico, sem depender da tradução atual', () => {
  expect(bibleReading()).toMatchObject({ read: 0, total: 1189, complete: 0, percent: 0 });
  expect(bibleReading().books).toHaveLength(66);
  expect(bibleReading(1).total).toBe(929);
  expect(bibleReading(2).total).toBe(260);
});

it('marca e desmarca um capítulo sem marcar automaticamente o livro', async () => {
  await markChapter(43, 3, true);
  expect(chapterRead(43, 3)).toBe(true);
  expect(bookReading(43)).toMatchObject({ read: 1, total: 21, complete: false });
  expect(bibleReading().read).toBe(1);
  await markChapter(43, 3, false);
  expect(bibleReading().read).toBe(0);
});

it('marca livro inteiro atomicamente e preserva os demais estudos e leituras', async () => {
  await completed('devotional:um-estudo', true);
  await markChapter(1, 1, true);
  await markBook(43, true);
  expect(bookReading(43)).toMatchObject({ read: 21, total: 21, complete: true, percent: 100 });
  expect(bibleReading()).toMatchObject({ read: 22, complete: 1 });
  await markBook(43, false);
  expect(chapterRead(1, 1)).toBe(true);
  expect(isCompleted('devotional:um-estudo')).toBe(true);
});

it('recupera capítulos do IndexedDB e não retém marcas removidas por restauração', async () => {
  await markBook(65, true);
  await loadProgress();
  expect(bookReading(65).complete).toBe(true);
  await write(['learning_progress'], (tx) => { tx.objectStore('learning_progress').clear(); });
  await put('learning_progress', { id: chapterReadingId(43, 3), completed: 1, updated_at: Date.now() });
  await loadProgress();
  expect(bookReading(65).read).toBe(0);
  expect(chapterRead(43, 3)).toBe(true);
});

it('salva linhas compatíveis com backup e migração existentes', async () => {
  await markBook(63, true);
  expect(await getAll('learning_progress')).toEqual([
    { id: 'bible:chapter:63:1', completed: 1, updated_at: expect.any(Number) },
  ]);
});

it('rejeita livros e capítulos inexistentes sem produzir progresso falso', async () => {
  expect(() => chapterReadingId(43, 22)).toThrow(RangeError);
  expect(() => chapterReadingId(0, 1)).toThrow(RangeError);
  await expect(markBook(67, true)).rejects.toThrow(RangeError);
  expect(bibleReading().read).toBe(0);
});
