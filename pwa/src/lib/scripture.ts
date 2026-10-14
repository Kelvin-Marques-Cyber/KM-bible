// Port de lib/scripture_links.dart e referencesIn() de lib/common.dart.
import { abbreviationsPt, booksEn, booksEs, booksPt, osisBooks, parseRef, refId, type Ref } from './domain';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const names = [...new Set([...booksPt, ...booksEn, ...booksEs, ...osisBooks, ...abbreviationsPt])].sort(
  (a, b) => b.length - a.length,
);
const referencePattern = new RegExp(
  `(^|[\\s(;,>*_#])(${names.map(escape).join('|')})(?:\\.)?\\s*(\\d{1,3})[:.](\\d{1,3})(?:\\s*[-–]\\s*(?:(\\d{1,3})[:.])?(\\d{1,3}))?`,
  'gimu',
);

/** Acrescenta navegação a citações comuns, preservando links e código. */
export function linkScriptureReferences(input: string): string {
  const held: string[] = [];
  let text = input.replace(/```[\s\S]*?```|`[^`\n]*`|\[\[[^\]]+\]\]|\[[^\]\n]+\]\([^)\n]+\)/g, (m) => {
    held.push(m);
    return `${held.length - 1}`;
  });
  text = text.replace(referencePattern, (whole, prefix: string, book: string, chapter: string, verse: string, endChapter?: string, endVerse?: string) => {
    const label = whole.substring(prefix.length);
    const start = parseRef(`${book} ${chapter}:${verse}`);
    if (!start) return whole;
    const end: Ref | null = endVerse ? { book: start.book, chapter: Number(endChapter ?? chapter), verse: Number(endVerse) } : null;
    const address = end ? `${refId(start)}..${refId(end)}` : refId(start);
    return `${prefix}[${label}](biblia:${encodeURIComponent(address)})`;
  });
  text = text.replace(/\b(CFW|WCF|BCW|WSC|CMW|WLC)\s*(\d{1,3})(?:[.:]\d+)?/gi, (whole, code: string, n: string) => {
    const map: Record<string, string> = { CFW: 'WCF', BCW: 'WSC', CMW: 'WLC' };
    const normalized = map[code.toUpperCase()] ?? code.toUpperCase();
    return `[${whole}](confession:${normalized}:${n})`;
  });
  return text.replace(/(\d+)/g, (_, i: string) => held[Number(i)]);
}

export function linkedReferences(text: string): Ref[] {
  const result = new Map<string, Ref>();
  const linked = linkScriptureReferences(text);
  for (const match of linked.matchAll(/\]\(biblia:([^)]+)\)/g)) {
    const target = decodeURIComponent(match[1]);
    for (const item of target.split('..')) {
      const r = parseRef(item);
      if (r) result.set(refId(r), r);
    }
  }
  return [...result.values()];
}

export function referencesIn(text: string): Ref[] {
  const result = new Map<string, Ref>();
  for (const m of text.matchAll(/([1-3]?\s*[A-Za-zÀ-ú]{2,})\s*(\d+)[.:](\d+)/g)) {
    const r = parseRef(`${m[1]} ${m[2]}:${m[3]}`);
    if (r) result.set(refId(r), r);
  }
  return [...result.values()];
}

/** Destinos [[...]] de uma nota, como Store.saveNote. */
export function wikiTargets(body: string): { target: string; kind: 'biblical' | 'personal' }[] {
  const out: { target: string; kind: 'biblical' | 'personal' }[] = [];
  for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].trim();
    const r = parseRef(target);
    out.push(r ? { target: refId(r), kind: 'biblical' } : { target: target.startsWith('note:') ? target.slice(5) : target, kind: 'personal' });
  }
  for (const r of linkedReferences(body)) out.push({ target: refId(r), kind: 'biblical' });
  return out;
}
