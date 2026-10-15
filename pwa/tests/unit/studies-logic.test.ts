// Lógica pura da área de estudos (studies.dart, religion_curricula.dart,
// study_catalog.dart, agostinho.dart) e dos devocionais.
import { describe, expect, it } from 'vitest';
import type { DocumentRow } from '../../src/lib/content';
import {
  APPROACHES,
  AUGUSTINE_BOOKS,
  CONFESSION_TABS,
  COURSE_TOPIC_ORDER,
  KNOWN_DEVOTIONALS,
  STAGE_NAMES,
  apologists,
  arenaNote,
  arenaProgressId,
  augustineBookmarkKey,
  augustineCopyText,
  augustineCredits,
  calendarDay,
  clampPosition,
  collectionName,
  confessionHaystack,
  devotionalCopyText,
  devotionalHaystack,
  devotionalLastKey,
  devotionalProgressId,
  docNumber,
  evaluateResponse,
  filterStudies,
  firstUnreadIndex,
  footnotePieces,
  isCalendarCollection,
  isDevotionalCollection,
  leapDayOfYear,
  levelKey,
  paragraphs,
  referenceLabels,
  religionFamilies,
  religionTargets,
  shortTitle,
  sortByNumber,
  sortCourse,
  sortDevotionals,
  sortStudies,
  sourceLabel,
  sourceTitle,
  sourceUrl,
  splitMarkdownSections,
  stageInstruction,
  stepPosition,
  studyNoteBody,
  studyRefs,
  todayIndex,
  todayLeapDay,
  topicTitles,
  traditionTitle,
  traditionTitles,
  validAugustineCounts,
} from '../../src/lib/studies-logic';

const COUNTS = [20, 10, 12, 16, 14, 16, 21, 12, 13, 43, 31, 32, 38];

const doc = (id: string, metadata: Record<string, unknown> = {}, extra: Partial<DocumentRow> = {}): DocumentRow => ({
  id,
  module_id: id.split(':')[0],
  kind: 'study',
  title: id,
  body: '',
  reference: '',
  metadata,
  ...extra,
});

describe('catálogo de estudos', () => {
  it('keeps the Dart map order (expanded first, then the classic entries)', () => {
    const topics = Object.keys(topicTitles);
    expect(topics[0]).toBe('origins');
    expect(topics.slice(-7)).toEqual(['sabbath', 'baptism', 'salvation', 'evil', 'scripture', 'resurrection', 'trinity']);
    const traditions = Object.keys(traditionTitles);
    expect(traditions[0]).toBe('lutheran');
    expect(traditions.slice(-5)).toEqual(['presbyterian', 'baptist', 'seventh_day_adventist', 'roman_catholic', 'atheism']);
    expect(traditionTitles.atheism).toBe('Ateísmo / objeções filosóficas');
    expect(traditionTitle('unknown_target')).toBe('unknown_target');
  });

  it('sorts like ORDER BY level, title and filters by topic/target/level', () => {
    const rows = [
      { id: 'c', level: 2, title: 'B', topic: 'x', target: 't1' },
      { id: 'a', level: 1, title: 'Z', topic: 'y', target: 't1' },
      { id: 'b', level: 1, title: 'A', topic: 'x', target: 't2' },
    ];
    expect(sortStudies(rows).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(filterStudies(rows, { topic: 'x' }).map((r) => r.id)).toEqual(['c', 'b']);
    expect(filterStudies(rows, { target: 't1', level: 1 }).map((r) => r.id)).toEqual(['a']);
    expect(filterStudies(rows, { topic: null, target: null, level: null })).toHaveLength(3);
  });

  it('maps levels to label keys', () => {
    expect([1, 2, 3].map(levelKey)).toEqual(['beginner', 'intermediate', 'advanced']);
    expect(levelKey(0)).toBe('beginner');
    expect(levelKey(9)).toBe('advanced');
  });

  it('builds the study note body and references', () => {
    expect(studyNoteBody('curriculum-x')).toBe('Estudo: curriculum-x\n\n');
    expect(studyRefs({ refs: ['43:3:16', 'bad', '1:1:1'] })).toEqual([
      { book: 43, chapter: 3, verse: 16 },
      { book: 1, chapter: 1, verse: 1 },
    ]);
  });

  it('formats sources (strings or {title,url})', () => {
    const item = { title: 'Fonte', url: 'https://example.org/a' };
    expect(sourceLabel(item)).toBe('Fonte\nhttps://example.org/a');
    expect(sourceUrl(item)).toBe('https://example.org/a');
    expect(sourceTitle(item)).toBe('Fonte');
    expect(sourceUrl('https://www.wts.edu/')).toBe('https://www.wts.edu/');
    expect(sourceUrl('Livro impresso, p. 3')).toBeNull();
    expect(sourceUrl({ title: 'x', url: 'javascript:alert(1)' })).toBeNull();
    expect(sourceTitle({ title: '', url: 'https://a.b' })).toBe('https://a.b');
  });
});

describe('religiões', () => {
  const all = [{ target: 'roman_catholic' }, { target: 'roman_catholic' }, { target: 'islam' }, { target: 'atheism' }, { target: 'zzz' }];

  it('lists only traditions with studies, in traditionTitles order, with counts', () => {
    const list = religionTargets(all, '', '');
    expect(list.map((e) => e.target)).toEqual(['islam', 'roman_catholic', 'atheism']);
    expect(list.find((e) => e.target === 'roman_catholic')?.count).toBe(2);
  });

  it('filters by family and by accent-insensitive text', () => {
    expect(religionTargets(all, 'Cristianismo', '').map((e) => e.target)).toEqual(['roman_catholic']);
    expect(religionTargets(all, '', 'catolica').map((e) => e.target)).toEqual(['roman_catholic']);
    expect(religionTargets(all, 'Cosmovisões não religiosas', 'ATEÍSMO').map((e) => e.target)).toEqual(['atheism']);
    expect(Object.keys(religionFamilies)).toHaveLength(6);
  });

  it('orders a course by the curriculum topics, unknown topics last (stable)', () => {
    const rows = [
      { id: 1, topic: 'afterlife' },
      { id: 2, topic: 'zzz' },
      { id: 3, topic: 'origins' },
      { id: 4, topic: 'yyy' },
      { id: 5, topic: 'salvation' },
    ];
    expect(sortCourse(rows).map((r) => r.id)).toEqual([3, 5, 1, 2, 4]);
    expect(COURSE_TOPIC_ORDER[0]).toBe('origins');
  });
});

describe('arena', () => {
  it('evaluates exactly like the original for a short answer (stage 1)', () => {
    expect(evaluateResponse('Deus existe.', 1)).toBe(
      [
        'Desenvolva premissas e conclusão em vez de uma afirmação isolada.',
        'Inclua uma referência bíblica e explique seu contexto.',
        'Identifique uma fonte confessional ou histórica.',
        'Esta verificação avalia estrutura textual. Não julga a verdade teológica da resposta.',
      ].join('\n\n'),
    );
  });

  it('reports references, sources and stage requirements (stage 3)', () => {
    const text = `${'Premissa longa. '.repeat(10)}Romanos 8:28 e João 3:16 segundo a Confissão de Westminster.`;
    const out = evaluateResponse(text, 3).split('\n\n');
    expect(out[0]).toBe('Identifique quais frases são premissas e qual é a conclusão.');
    expect(out[1]).toBe(
      'Referências encontradas: Romanos 8:28, João 3:16. Confira o contexto; a presença da referência não prova o argumento.',
    );
    expect(out[2]).toBe('Confira se a fonte citada sustenta sua afirmação.');
    expect(out[3]).toBe('Compare sua representação com a exposição descritiva do estudo.');
    expect(out[4]).toBe('Apresente a objeção mais forte e uma resposta possível do interlocutor.');
    expect(out).toHaveLength(6);
    expect(evaluateResponse('https://x CFW', 2).split('\n\n')).toHaveLength(5);
  });

  it('builds the laboratory note and progress id', () => {
    expect(arenaNote({ id: 's1', title: 'Título' }, 'Pressuposicional reformada', 2, 'Resposta', 'Retorno')).toEqual({
      title: 'Laboratório: Título',
      body: 'Abordagem: Pressuposicional reformada\nEtapa: 2\n\nResposta\n\nRetorno',
      reference: 's1',
      notebook: 'Laboratório',
    });
    expect(arenaNote({ id: 's1', title: 'T' }, 'A', 1, 'R', null).body).toBe('Abordagem: A\nEtapa: 1\n\nR\n\n');
    expect(arenaProgressId('s1', 3)).toBe('arena:s1:3');
    expect(STAGE_NAMES).toEqual(['Fundamentar', 'Responder', 'Debater']);
    expect(APPROACHES).toEqual(['presuppositional', 'evidential', 'exegetical']);
    expect(stageInstruction(1)).toBe('Formule uma tese e duas premissas.');
    expect(stageInstruction(2)).toBe('Represente a posição interlocutora e responda com fontes.');
    expect(stageInstruction(3)).toBe('Inclua objeção forte, resposta e réplica possível.');
  });

  it('keeps the six apologists from the original', () => {
    expect(apologists.map((a) => a.name)).toEqual([
      'Cornelius Van Til',
      'Greg L. Bahnsen',
      'Francis A. Schaeffer',
      'João Calvino',
      'Herman Bavinck',
      'Alvin Plantinga',
    ]);
    expect(apologists.every((a) => /^https:\/\//.test(a.source))).toBe(true);
  });
});

describe('confissões', () => {
  it('has the four tabs of the original', () => {
    expect(CONFESSION_TABS).toEqual([
      ['WCF', 'Confissão · 33'],
      ['WSC', 'Breve · 107'],
      ['WLC', 'Maior · 196'],
      ['AUG', 'Agostinho · 13 livros'],
    ]);
  });

  it('sorts by metadata.number and labels references', () => {
    const rows = [doc('WSC.3', { number: 3 }), doc('WSC.x', {}), doc('WSC.1', { number: 1, references: ['43:3:16', 'x'] })];
    expect(sortByNumber(rows).map((d) => d.id)).toEqual(['WSC.x', 'WSC.1', 'WSC.3']);
    expect(docNumber(rows[0])).toBe(3);
    expect(referenceLabels(rows[2], 'pt')).toBe('João 3:16 · x');
    expect(referenceLabels(rows[2], 'en')).toBe('John 3:16 · x');
  });

  it('searches title, body and the Portuguese body without accents', () => {
    const d = doc('WCF.1', {}, { title: 'Of the Holy Scripture', body: 'guia', pt: { title: '', body: 'Das Escrituras Sagradas', status: '' } });
    expect(confessionHaystack(d)).toContain('escrituras sagradas');
    expect(confessionHaystack(d)).toContain('holy scripture');
  });
});

describe('Agostinho', () => {
  it('validates the full index (13 books, 278 chapters)', () => {
    expect(validAugustineCounts(COUNTS, 278)).toBe(true);
    expect(validAugustineCounts(COUNTS.slice(1), 278)).toBe(false);
    expect(validAugustineCounts(COUNTS, 277)).toBe(false);
    expect(AUGUSTINE_BOOKS.map((b) => b.chapterCount)).toEqual(COUNTS);
  });

  it('clamps positions and steps across books', () => {
    expect(clampPosition(COUNTS, 99, 99)).toEqual([12, 37]);
    expect(clampPosition(COUNTS, -1, -5)).toEqual([0, 0]);
    expect(clampPosition(COUNTS, Number.NaN, 3)).toEqual([0, 3]);
    expect(stepPosition(COUNTS, 0, 0, -1)).toBeNull();
    expect(stepPosition(COUNTS, 0, 19, 1)).toEqual([1, 0]);
    expect(stepPosition(COUNTS, 1, 0, -1)).toEqual([0, 19]);
    expect(stepPosition(COUNTS, 12, 37, 1)).toBeNull();
    expect(stepPosition(COUNTS, 4, 5, 1)).toEqual([4, 6]);
  });

  it('uses 1-based bookmark keys and the credits of the original', () => {
    expect(augustineBookmarkKey(0, 0)).toBe('agostinho_favorito_1_1');
    expect(augustineBookmarkKey(12, 37)).toBe('agostinho_favorito_13_38');
    expect(augustineCopyText(1, 2, 'Texto.')).toBe(
      'Confissões de Santo Agostinho — Livro 2, capítulo 3\n\nTexto.\n\nTradução: J. Oliveira Santos e A. Ambrósio de Pina. Fonte: Solus Ágape.',
    );
    expect(augustineCredits({ source: 'S', translator: 'T', edition: 'E', license: 'L' })).toBe('Fonte: S\nTradução: T\nEdição: E\nL');
  });

  it('splits paragraphs on blank lines', () => {
    expect(paragraphs('Um.\n\nDois\ncontinua.\n \nTrês.')).toEqual(['Um.', 'Dois\ncontinua.', 'Três.']);
  });

  it('marks plain-digit footnote calls only when the note exists and preserves Unicode superscripts', () => {
    const pieces = footnotePieces('O buscarem6. Louvado¹ seja, no ano 386 e pregador7.', new Set([6, 7]));
    expect(pieces.filter((p) => p.note).map((p) => p.text)).toEqual(['6', '7']);
    expect(pieces.map((p) => p.text).join('')).toBe('O buscarem6. Louvado¹ seja, no ano 386 e pregador7.');
    expect(footnotePieces('Sem notas 5.', new Set())).toEqual([{ text: 'Sem notas 5.' }]);
    expect(footnotePieces('cruel a ceder162.', new Set([16]))).toEqual([{ text: 'cruel a ceder162.' }]);
  });
});

describe('devocionais', () => {
  it('detects devotional collections', () => {
    const base = { kind: 'study', metadata: {} };
    expect(isDevotionalCollection({ ...base, id: 'EXP-SPURGEON-DIARIO', title: 'x' })).toBe(true);
    expect(isDevotionalCollection({ ...base, id: 'EXP-JORNADA-DIARIO', title: 'x' })).toBe(true);
    expect(isDevotionalCollection({ ...base, id: 'BESSA', title: 'Devocionais de Josemar Bessa' })).toBe(true);
    expect(isDevotionalCollection({ ...base, id: 'X', title: 'Pão Diário' })).toBe(true);
    expect(isDevotionalCollection({ ...base, id: 'Y', title: 'Leituras', metadata: { days: 365 } })).toBe(true);
    expect(isDevotionalCollection({ ...base, id: 'Z', title: 'Panorama dos 66 livros' })).toBe(false);
    expect(Object.keys(KNOWN_DEVOTIONALS)).toEqual(['EXP-SPURGEON-DIARIO', 'EXP-JORNADA-DIARIO']);
  });

  it('names collections', () => {
    expect(collectionName({ id: 'EXP-SPURGEON-DIARIO', title: 'x' })).toBe('Café da Manhã com Spurgeon');
    expect(collectionName({ id: 'EXP-JORNADA-DIARIO', title: 'x' }, 'en')).toBe('Reformed Journey');
    expect(collectionName({ id: 'B', title: 'Bessa — abrir por dia (365 leituras)' })).toBe('Bessa');
  });

  it('computes the leap-calendar day (Feb 29 = 60, Mar 1 = 61 every year)', () => {
    expect(leapDayOfYear(0, 1)).toBe(1);
    expect(leapDayOfYear(1, 29)).toBe(60);
    expect(leapDayOfYear(2, 1)).toBe(61);
    expect(leapDayOfYear(11, 31)).toBe(366);
    expect(todayLeapDay(new Date(2027, 2, 1))).toBe(61);
    expect(todayLeapDay(new Date(2028, 1, 29))).toBe(60);
  });

  const spurgeon = Array.from({ length: 366 }, (_, i) => doc(`EXP-SPURGEON-DIARIO:cafe-${i + 1}`, { date_order: i + 1 }));

  it('picks today in a 366-day collection, including Feb 29', () => {
    expect(spurgeon[todayIndex(spurgeon, new Date(2026, 0, 1))].metadata.date_order).toBe(1);
    expect(spurgeon[todayIndex(spurgeon, new Date(2028, 1, 29))].metadata.date_order).toBe(60);
    expect(spurgeon[todayIndex(spurgeon, new Date(2026, 2, 1))].metadata.date_order).toBe(61);
    expect(spurgeon[todayIndex(spurgeon, new Date(2026, 9, 15))].metadata.date_order).toBe(289);
    expect(spurgeon[todayIndex(spurgeon, new Date(2026, 11, 31))].metadata.date_order).toBe(366);
    expect(isCalendarCollection('EXP-SPURGEON-DIARIO', spurgeon)).toBe(true);
  });

  it('skips Feb 29 in 365-day collections and falls back to the previous day', () => {
    const days = Array.from({ length: 365 }, (_, i) => doc(`M:${i + 1}`, { date_order: i + 1 }));
    expect(calendarDay(days[59], 365)).toBe(61);
    expect(days[todayIndex(days, new Date(2026, 2, 1))].id).toBe('M:60');
    expect(days[todayIndex(days, new Date(2028, 1, 29))].id).toBe('M:59');
    expect(isCalendarCollection('M', days)).toBe(true);
    expect(calendarDay(doc('d', { date: '02-29' }), 366)).toBe(60);
    expect(calendarDay(doc('d', { date: '01/03' }), 366)).toBe(61);
    expect(calendarDay(doc('d', { month: 12, day: 25 }), 366)).toBe(360);
  });

  it('orders readings by declared order and finds the first unread', () => {
    const rows = [doc('J:b', { date_order: 2 }), doc('J:x'), doc('J:a', { date_order: 1 }), doc('J:c', { order: '3' })];
    expect(sortDevotionals(rows).map((d) => d.id)).toEqual(['J:a', 'J:b', 'J:c', 'J:x']);
    const read = new Set(['J:a', 'J:b']);
    expect(firstUnreadIndex(sortDevotionals(rows), (id) => read.has(id))).toBe(2);
    expect(firstUnreadIndex(rows.slice(0, 1), () => true)).toBe(0);
    expect(isCalendarCollection('EXP-JORNADA-DIARIO', rows)).toBe(false);
    expect(isCalendarCollection('OTHER', rows)).toBe(false);
  });

  it('formats titles, copy text, ids and search text', () => {
    expect(shortTitle('Café da manhã com Spurgeon — 01/01: Graça antes do mérito')).toBe('01/01: Graça antes do mérito');
    expect(shortTitle('Jornada reformada — leitura 001: arrependimento')).toBe('Leitura 001: arrependimento');
    expect(shortTitle('Sem coleção')).toBe('Sem coleção');
    const d = doc('EXP-SPURGEON-DIARIO:cafe-001', {}, { title: 'Título', body: 'Corpo' });
    expect(devotionalCopyText(d, { author: 'Redação', title: 'Café', source: 'https://s', license: 'CC BY 4.0' })).toBe(
      'Título\n\nCorpo\n\nRedação; Café; EXP-SPURGEON-DIARIO:cafe-001; https://s\nCC BY 4.0',
    );
    expect(devotionalProgressId('A:1')).toBe('devocional:A:1');
    expect(devotionalLastKey('EXP-JORNADA-DIARIO')).toBe('devocional_ultimo_EXP-JORNADA-DIARIO');
    expect(devotionalHaystack({ title: 'Graça', body: 'Fé e Obediência' })).toBe('graca fe e obediencia');
  });
});

describe('Markdown longo', () => {
  it('splits only before headings and never inside code fences', () => {
    const long = 'x'.repeat(700);
    const text = `# A\n${long}\n## B\n${long}\n\`\`\`\n# não é título\n\`\`\`\n## C\ncurto\n## D\nfim`;
    const sections = splitMarkdownSections(text);
    // "# não é título" (dentro do bloco de código) não corta; "## D" não corta porque "## C" é curta.
    expect(sections).toHaveLength(3);
    expect(sections[0].startsWith('# A')).toBe(true);
    expect(sections[1].startsWith('## B')).toBe(true);
    expect(sections[1]).toContain('# não é título');
    expect(sections[2]).toBe('## C\ncurto\n## D\nfim');
    expect(splitMarkdownSections('curto')).toEqual(['curto']);
  });
});
