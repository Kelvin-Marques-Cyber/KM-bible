import { describe, expect, it } from 'vitest';
import type { ModuleInfo } from '../../src/lib/catalog';
import type { CommentaryEntry } from '../../src/lib/content';
import { ref } from '../../src/lib/domain';
import {
  authorChipLabels,
  authorIds,
  authorLabel,
  baseWords,
  commentaryCitation,
  commentaryModule,
  commentaryRank,
  curatedRows,
  diffKey,
  diffSegments,
  filterByAuthors,
  filterXrefs,
  hasHernandesEntry,
  localizedEntries,
  mergeCommentaryGroups,
  placeTitle,
  previewText,
  relationLabel,
  sortCommentaries,
  sortPlaces,
  stableKeys,
  translation,
  verseText,
  xrefTitle,
} from '../../src/lib/commentaries-logic';

const entry = (module_id: string, id: string, extra: Partial<CommentaryEntry> = {}): CommentaryEntry => ({
  id,
  module_id,
  reference: '43:3:16',
  end_reference: '43:3:21',
  start_key: 43003016,
  end_key: 43003021,
  title: `${module_id} title`,
  body: `${module_id} body`,
  kind: 'exegesis',
  bibliography: 'Bib',
  ...extra,
});

const info = (id: string, extra: Partial<ModuleInfo> = {}): ModuleInfo => ({
  id,
  title: `${id} title`,
  kind: 'commentary',
  language: 'en',
  version: '1.0',
  author: `${id} author`,
  license: 'Public Domain',
  source: 'https://example.org',
  installed: true,
  builtin: true,
  metadata: {},
  origin: 'catalogue',
  ...extra,
});

describe('commentaries ordering and filtering', () => {
  it('ranks HDL first, Calvin second, others after, keeping order within groups', () => {
    expect(commentaryRank('HDL-JOAO')).toBe(0);
    expect(commentaryRank('CalvinCommentaries')).toBe(1);
    expect(commentaryRank('MHCC')).toBe(2);
    const sorted = sortCommentaries([
      entry('Barnes', 'b1'),
      entry('CalvinCommentaries', 'c1'),
      entry('MHCC', 'm1'),
      entry('HDL-GUIA-FONTES', 'h1'),
      entry('Barnes', 'b2'),
      entry('CalvinCommentaries', 'c2'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['h1', 'c1', 'c2', 'b1', 'm1', 'b2']);
  });

  it('treats only non-empty Portuguese bodies as translations', () => {
    expect(translation(entry('MHCC', 'x'))).toBeNull();
    expect(translation(entry('MHCC', 'x', { pt: { title: 't', body: '  ', status: 's' } }))).toBeNull();
    expect(translation(entry('MHCC', 'x', { pt: { title: 't', body: 'corpo', status: 's' } }))?.body).toBe('corpo');
  });

  it('hides English-only entries in the Portuguese UI unless originals are requested', () => {
    const list = [
      entry('Barnes', 'b'),
      entry('MHCC', 'm', { pt: { title: 'T', body: 'Tradução', status: 'Revisão pendente' } }),
      entry('EXP2-CH-1189', 'p'),
    ];
    const language = (id: string) => (id === 'EXP2-CH-1189' ? 'pt-BR' : 'en');
    expect(localizedEntries(list, 'pt', false, language).map((e) => e.id)).toEqual(['m', 'p']);
    expect(localizedEntries(list, 'pt', true, language).map((e) => e.id)).toEqual(['b', 'm', 'p']);
    expect(localizedEntries(list, 'en', false, language).map((e) => e.id)).toEqual(['b', 'm', 'p']);
  });

  it('hides the Hernandes notice whenever an HDL* entry exists, like the original', () => {
    expect(hasHernandesEntry([entry('HDL-GUIA-FONTES', 'g')])).toBe(true);
    expect(hasHernandesEntry([entry('HDL-JOAO', 'j')])).toBe(true);
    expect(hasHernandesEntry([entry('MHCC', 'm'), entry('JOSEMAR-GUIA-FONTES', 'j')])).toBe(false);
    expect(hasHernandesEntry([])).toBe(false);
  });

  it('merges per-module results in the order of content.commentaries', () => {
    const merged = mergeCommentaryGroups([
      { id: 'MHCC', entries: [entry('MHCC', 'm1', { start_key: 43003001 }), entry('MHCC', 'm2', { start_key: 43003016 })] },
      { id: 'Barnes', entries: [entry('Barnes', 'b1')] },
      { id: 'CalvinCommentaries', entries: [] },
      { id: 'EXP2-CH-1189', entries: [entry('EXP2-CH-1189', 'e1')] },
    ]);
    expect(merged.map((e) => e.id)).toEqual(['b1', 'e1', 'm2', 'm1']);
  });

  it('labels authors like the original filter chips', () => {
    expect(authorLabel('HDL-JOAO', info('HDL-JOAO'))).toBe('Hernandes · João');
    expect(authorLabel('MHCC', info('MHCC', { author: 'Matthew Henry' }))).toBe('Matthew Henry');
    expect(authorLabel('CalvinCommentaries', undefined)).toBe('João Calvino');
    expect(authorLabel('XYZ', undefined)).toBe('XYZ');
  });

  it('disambiguates filter chips that share an author', () => {
    const lookup = (id: string) =>
      id === 'X' ? undefined : info(id, { author: id === 'MHCC' ? 'Matthew Henry' : 'Equipe editorial independente' });
    const labels = authorChipLabels(['MHCC', 'EXP2-CALV-PT', 'EXP2-CH-1189', 'X'], lookup);
    expect(labels.get('MHCC')).toBe('Matthew Henry');
    expect(labels.get('EXP2-CALV-PT')).toBe('EXP2-CALV-PT title');
    expect(labels.get('EXP2-CH-1189')).toBe('EXP2-CH-1189 title');
    expect(labels.get('X')).toBe('X');
  });

  it('lists authors once and falls back to all entries when the selection does not match', () => {
    const list = [entry('A', '1'), entry('B', '2'), entry('A', '3')];
    expect(authorIds(list)).toEqual(['A', 'B']);
    expect(filterByAuthors(list, new Set(['A'])).map((e) => e.id)).toEqual(['1', '3']);
    expect(filterByAuthors(list, new Set(['C'])).map((e) => e.id)).toEqual(['1', '2', '3']);
    expect(filterByAuthors(list, new Set()).map((e) => e.id)).toEqual(['1', '2', '3']);
  });
});

describe('commentary text', () => {
  it('truncates previews at 2500 characters on a word boundary', () => {
    const short = 'palavra '.repeat(10);
    expect(previewText(short)).toBe(short);
    const long = 'abcd '.repeat(700); // 3500 caracteres
    const preview = previewText(long);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(2501);
    expect(preview.slice(0, -1).endsWith('abcd')).toBe(true);
    const noSpaces = 'x'.repeat(3000);
    expect(previewText(noSpaces)).toBe(`${'x'.repeat(2500)}…`);
  });

  it('uses the historical Calvin fallback when the module is missing', () => {
    const m = commentaryModule('CalvinCommentaries', undefined);
    expect(m).toMatchObject({ author: 'João Calvino', language: 'en', version: 'public.1', license: 'Domínio público', source: 'CCEL — edição histórica' });
    expect(commentaryModule('MHCC', info('MHCC')).title).toBe('MHCC title');
  });

  it('builds the citation exactly like the original app', () => {
    const e = entry('MHCC', 'm', { reference: '43:3:1', end_reference: '43:3:8', bibliography: 'Matthew Henry — Concise Commentary' });
    const m = commentaryModule('MHCC', info('MHCC', { author: 'Matthew Henry', title: 'Matthew Henry — Concise Commentary', version: '1.0', license: 'Public Domain' }));
    const body = 'a'.repeat(1600);
    expect(commentaryCitation(body, m, 'João 3:16', e)).toBe(
      `${'a'.repeat(1500)}\n\nMatthew Henry; Matthew Henry — Concise Commentary; João 3:16; entrada 43:3:1–43:3:8; Matthew Henry — Concise Commentary; módulo MHCC 1.0; Public Domain.`,
    );
    expect(commentaryCitation('curto', m, 'João 3:16', e).startsWith('curto\n\n')).toBe(true);
  });
});

describe('comparison differences', () => {
  it('folds accents, case and edge punctuation', () => {
    expect(diffKey('Mundo,')).toBe('mundo');
    expect(diffKey('«Então»')).toBe('entao');
    expect(diffKey('—')).toBe('');
  });

  it('marks only words absent from the base verse and keeps spacing', () => {
    const base = baseWords('Porque Deus amou o mundo de tal maneira');
    const segments = diffSegments('Porque Deus amou tanto o mundo,  que', base);
    expect(segments.map((s) => s.text).join('')).toBe('Porque Deus amou tanto o mundo,  que');
    expect(segments.filter((s) => s.changed).map((s) => s.text)).toEqual(['tanto', 'que']);
  });
});

describe('cross references', () => {
  const relations = [
    { from: '23:53:5', to: '60:2:24', kind: 'textual', description: 'Isaías em 1 Pedro' },
    { from: '1:15:6', to: '45:4:3', kind: 'theological', description: 'Gênesis em Romanos' },
  ];

  it('uses curated relations in both directions', () => {
    expect(curatedRows(relations, '60:2:24')).toEqual([
      { target: '23:53:5', end_reference: '23:53:5', kind: 'textual', provenance: 'Isaías em 1 Pedro', scope: 'verse' },
    ]);
    expect(curatedRows(relations, '1:15:6')[0].target).toBe('45:4:3');
    expect(curatedRows(relations, '43:3:16')).toEqual([]);
  });

  it('filters by kind and drops invalid targets', () => {
    const rows = [
      { target: '45:5:8', end_reference: '45:5:8', kind: 'editorial', provenance: 'TSK', scope: 'verse' as const },
      { target: '1:1:1', end_reference: '1:1:1', kind: 'textual', provenance: 'x', scope: 'verse' as const },
      { target: 'bad', end_reference: 'bad', kind: 'textual', provenance: 'x', scope: 'verse' as const },
    ];
    expect(filterXrefs(rows, 'all')).toHaveLength(2);
    expect(filterXrefs(rows, 'textual').map((r) => r.target)).toEqual(['1:1:1']);
    expect(filterXrefs(rows, 'theological')).toEqual([]);
  });

  it('labels relations and ranges', () => {
    expect(relationLabel('textual', 'pt')).toBe('Citação textual');
    expect(relationLabel('unknown', 'pt')).toBe('Referência editorial');
    expect(relationLabel('theological', 'en')).toBe('Theological interpretation');
    expect(xrefTitle(ref(62, 4, 9), ref(62, 4, 9), 'pt')).toBe('1 João 4:9');
    expect(xrefTitle(ref(62, 4, 9), ref(62, 4, 10), 'pt')).toBe('1 João 4:9 – 1 João 4:10');
  });

  it('reads verse text from a loaded book, even with gaps in numbering', () => {
    const book = { c: [[[1, 'um'], [2, 'dois']], [[1, 'a'], [3, 'c']]] as [number, string][][] };
    expect(verseText(book, ref(1, 1, 2))).toBe('dois');
    expect(verseText(book, ref(1, 2, 3))).toBe('c');
    expect(verseText(book, ref(1, 2, 2))).toBeNull();
    expect(verseText(book, ref(1, 9, 1))).toBeNull();
    expect(verseText(null, ref(1, 1, 1))).toBeNull();
  });
});

describe('saved places', () => {
  it('sorts canonically and keeps invalid references last so they can be deleted', () => {
    const rows = [
      { id: 'a', reference: '45:8:28', translation: 'ARA', title: 'Romanos 8:28' },
      { id: 'b', reference: '1:1:1', translation: 'BLN4', title: 'Gênesis 1:1' },
      { id: 'c', reference: 'x', translation: 'BLN4', title: 'inválido' },
      { id: 'd', reference: '43:3:16', translation: 'BLN4', title: 'João 3:16' },
    ];
    expect(sortPlaces(rows).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('titles places by their own title, the reference label or the raw address', () => {
    expect(placeTitle({ id: '1', reference: '43:3:16', translation: 'BLN4', title: 'Aba' }, 'pt')).toBe('Aba');
    expect(placeTitle({ id: '2', reference: '43:3:16', translation: 'BLN4', title: '' }, 'en')).toBe('John 3:16');
    expect(placeTitle({ id: '3', reference: 'x:y', translation: 'BLN4', title: '' }, 'pt')).toBe('x:y');
  });
});

describe('stable keys', () => {
  it('keeps the first occurrence unchanged and numbers repeats', () => {
    expect(stableKeys(['a', 'b', 'a', 'a'], (x) => x)).toEqual(['a', 'b', 'a#1', 'a#2']);
  });
});
