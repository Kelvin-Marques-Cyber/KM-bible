import { describe, expect, it } from 'vitest';
import type { DocumentRow, Study } from '../../src/lib/content';
import { ref } from '../../src/lib/domain';
import {
  authorLine,
  documentCitation,
  documentReferences,
  estimateParagraphHeight,
  isConfessionModule,
  metadataLines,
  splitParagraphs,
  stripTags,
  studiesCiting,
  traditionTitle,
  truncateText,
} from '../../src/lib/studycontext';

const study = (id: string, refs: string[], target = 'presbyterian'): Study => ({
  id,
  level: 1,
  topic: 'origins',
  target,
  title: id,
  exposition: '',
  response: '',
  strongest: '',
  rejoinder: '',
  refs,
  sources: [],
});

const doc = (id: string, reference: string, extra: Partial<DocumentRow> = {}): DocumentRow => ({
  id,
  module_id: id.split(':')[0],
  kind: 'study',
  title: id,
  body: `corpo ${id}`,
  reference,
  metadata: {},
  ...extra,
});

describe('truncateText', () => {
  it('keeps short texts and cuts long ones with an ellipsis (Matthew Henry excerpt)', () => {
    expect(truncateText('abc', 5)).toBe('abc');
    expect(truncateText('a'.repeat(1800))).toBe('a'.repeat(1800));
    expect(truncateText('a'.repeat(1801))).toBe(`${'a'.repeat(1800)}…`);
  });
});

describe('splitParagraphs', () => {
  it('splits by blank lines and drops empty pieces like LongStudyText', () => {
    expect(splitParagraphs('### Título\n\n[Rm 8:28](biblia:45:8:28)\n \n\n\nFim\n')).toEqual(['### Título', '[Rm 8:28](biblia:45:8:28)', 'Fim\n']);
  });
  it('handles CRLF and keeps fenced code blocks whole', () => {
    expect(splitParagraphs('a\r\n\r\nb')).toEqual(['a', 'b']);
    expect(splitParagraphs('antes\n\n```\nx\n\ny\n```\n\ndepois')).toEqual(['antes', '```\nx\n\ny\n```', 'depois']);
  });
  it('returns an empty list for blank text', () => {
    expect(splitParagraphs('  \n\n ')).toEqual([]);
  });
});

describe('stripTags', () => {
  it('removes HTML from the original Torrey index while keeping line breaks', () => {
    const html = 'POMEGRANATE\r\n- Egypt abounded with<br /><scripRef>Nu 20:5</scripRef><br /><br />- Canaan';
    const text = stripTags(html);
    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain('Nu 20:5');
    expect(text.split('\n\n').length).toBe(2);
  });
  it('never leaves indentation that Markdown would turn into a code block', () => {
    const text = stripTags('TITLE<br />    <scripRef>Ge 1:1</scripRef>   and   <term>x</term><br/>\t- item');
    expect(text.split('\n').every((line) => !/^[ \t]/.test(line))).toBe(true);
    expect(text).toBe('TITLE\nGe 1:1 and x\n- item');
  });
});

describe('studiesCiting', () => {
  const all = [study('a', ['43:3:16']), study('b', ['43:1:1']), study('c', ['1:1:1']), study('d', ['43:3:16', '45:1:1'], 'atheism')];
  it('prefers studies citing the verse', () => {
    const result = studiesCiting(all, ref(43, 3, 16));
    expect(result.direct).toBe(true);
    expect(result.items.map((s) => s.id)).toEqual(['a', 'd']);
  });
  it('falls back to up to N studies citing the book', () => {
    const result = studiesCiting(all, ref(43, 5, 1), 2);
    expect(result.direct).toBe(false);
    expect(result.items.map((s) => s.id)).toEqual(['a', 'b']);
    expect(studiesCiting(all, ref(66, 1, 1)).items).toEqual([]);
  });
  it('names traditions like the original app', () => {
    expect(traditionTitle('presbyterian')).toBe('Presbiteriana reformada');
    expect(traditionTitle('atheism')).toBe('Ateísmo / objeções filosóficas');
    expect(traditionTitle('desconhecida')).toBe('desconhecida');
  });
});

describe('documents', () => {
  it('detects Westminster standards', () => {
    expect(isConfessionModule('WCF')).toBe(true);
    expect(isConfessionModule('WSC')).toBe(true);
    expect(isConfessionModule('WLC')).toBe(true);
    expect(isConfessionModule('EXP2-PAN-66')).toBe(false);
  });
  it('reads only metadata references (like the original DocumentPage), deduplicated', () => {
    const withRefs = doc('WCF.1', '', { metadata: { references: ['55:3:16', 'bad', '55:3:16', '61:1:21'] } });
    expect(documentReferences(withRefs)).toEqual([ref(55, 3, 16), ref(61, 1, 21)]);
    // A leitura principal (ex.: panorama do livro em 43:1:1) não vira chip.
    expect(documentReferences(doc('EXP2-PAN-66:panorama-43', '43:1:1', { metadata: { book: 43, scope: 'book' } }))).toEqual([]);
    expect(documentReferences(doc('X:1', '', { metadata: { references: 'não é lista' } }))).toEqual([]);
    expect(documentReferences(doc('X:2', ''))).toEqual([]);
  });
  it('copies with citation in the original format', () => {
    const d = doc('WCF.1', '', { body: 'Texto' });
    expect(documentCitation(d, { author: 'Assembleia de Westminster', title: 'Confissão', source: 'https://x' })).toBe(
      'Texto\n\nAssembleia de Westminster; Confissão; WCF.1; https://x',
    );
    expect(documentCitation(d, undefined)).toBe('Texto\n\n; ; WCF.1; ');
  });
  it('formats module metadata and author line', () => {
    expect(metadataLines({ entries: 33, edition: 'Histórica', empty: '', nested: { a: 1 } })).toBe('entries: 33\nedition: Histórica\nnested: {"a":1}');
    expect(metadataLines(undefined)).toBe('');
    expect(authorLine({ author: 'Matthew Henry', language: 'en' })).toBe('Matthew Henry · en');
  });
});

describe('estimateParagraphHeight', () => {
  it('grows with the text', () => {
    const short = estimateParagraphHeight('abc', 18);
    const long = estimateParagraphHeight('abc '.repeat(200), 18);
    expect(short).toBeGreaterThan(18);
    expect(long).toBeGreaterThan(short * 5);
    expect(estimateParagraphHeight('a\nb\nc', 18)).toBeGreaterThan(short * 2);
  });
});
