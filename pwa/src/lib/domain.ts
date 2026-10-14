// Port fiel de lib/domain.dart: referências, nomes de livros, revisão espaçada
// e cálculos históricos. Mantém os mesmos identificadores ("livro:cap:vers").

export type Lang = 'pt' | 'en' | 'es';

export const booksPt = [
  'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel',
  '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios',
  'Eclesiastes', 'Cântico dos Cânticos', 'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oseias',
  'Joel', 'Amós', 'Obadias', 'Jonas', 'Miqueias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias',
  'Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios',
  'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito',
  'Filemom', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse',
];
export const booksEn = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Songs', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
  'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];
export const booksEs = [
  'Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio', 'Josué', 'Jueces', 'Rut', '1 Samuel', '2 Samuel',
  '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras', 'Nehemías', 'Ester', 'Job', 'Salmos', 'Proverbios',
  'Eclesiastés', 'Cantar de los Cantares', 'Isaías', 'Jeremías', 'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas',
  'Joel', 'Amós', 'Abdías', 'Jonás', 'Miqueas', 'Nahúm', 'Habacuc', 'Sofonías', 'Hageo', 'Zacarías', 'Malaquías',
  'Mateo', 'Marcos', 'Lucas', 'Juan', 'Hechos', 'Romanos', '1 Corintios', '2 Corintios', 'Gálatas', 'Efesios',
  'Filipenses', 'Colosenses', '1 Tesalonicenses', '2 Tesalonicenses', '1 Timoteo', '2 Timoteo', 'Tito', 'Filemón',
  'Hebreos', 'Santiago', '1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan', 'Judas', 'Apocalipsis',
];
export const osisBooks = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr',
  'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel',
  'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John',
  'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm',
  'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev',
];
export const abbreviationsPt = [
  'Gn', 'Ex', 'Lv', 'Nm', 'Dt', 'Js', 'Jz', 'Rt', '1Sm', '2Sm', '1Rs', '2Rs', '1Cr', '2Cr', 'Ed', 'Ne', 'Et', 'Jo',
  'Sl', 'Pv', 'Ec', 'Ct', 'Is', 'Jr', 'Lm', 'Ez', 'Dn', 'Os', 'Jl', 'Am', 'Ob', 'Jn', 'Mq', 'Na', 'Hc', 'Sf', 'Ag',
  'Zc', 'Ml', 'Mt', 'Mc', 'Lc', 'João', 'At', 'Rm', '1Co', '2Co', 'Gl', 'Ef', 'Fp', 'Cl', '1Ts', '2Ts', '1Tm', '2Tm',
  'Tt', 'Fm', 'Hb', 'Tg', '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jd', 'Ap',
];

export function bookNames(language: string): string[] {
  return language === 'en' ? booksEn : language === 'es' ? booksEs : booksPt;
}

/** Remove acentos e caixa, como fold() do aplicativo original. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const TOKEN = /[\p{L}\p{N}]+/gu;
/** Mesmos tokens do índice gerado em Python (scripts/build_data.py). */
export function tokenize(text: string): string[] {
  const folded = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return (folded.match(TOKEN) ?? []).filter((t) => t.length <= 40 && !(/^\d+$/.test(t) && t.length > 4));
}

export function editDistance(a: string, b: string): number {
  let prior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next.push(Math.min(next[j - 1] + 1, prior[j] + 1, prior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prior = next;
  }
  return prior[prior.length - 1];
}

export interface Ref {
  book: number;
  chapter: number;
  verse: number;
}

export const ref = (book: number, chapter: number, verse = 1): Ref => ({ book, chapter, verse });
export const refId = (r: Ref) => `${r.book}:${r.chapter}:${r.verse}`;
export const refKey = (r: Ref) => r.book * 1_000_000 + r.chapter * 1000 + r.verse;
export const keyToRef = (key: number): Ref => ({
  book: Math.floor(key / 1_000_000),
  chapter: Math.floor(key / 1000) % 1000,
  verse: key % 1000,
});
export const sameRef = (a: Ref | null | undefined, b: Ref | null | undefined) =>
  !!a && !!b && a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

export function refLabel(r: Ref, language = 'pt'): string {
  return `${bookNames(language)[r.book - 1]} ${r.chapter}:${r.verse}`;
}

export function fromId(s: string | null | undefined): Ref | null {
  if (typeof s !== 'string') return null;
  const parts = s.split(':');
  if (parts.length !== 3) return null;
  const [b, c, v] = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if ([b, c, v].some((n) => Number.isNaN(n)) || b < 1 || b > 66 || c < 1 || c > 150 || v < 1 || v > 176) return null;
  return { book: b, chapter: c, verse: v };
}

const aliases: Record<string, number> = {
  gn: 1, ex: 2, lv: 3, nm: 4, dt: 5, js: 6, jz: 7, rt: 8, '1sm': 9, '2sm': 10, '1rs': 11, '2rs': 12, '1cr': 13,
  '2cr': 14, ed: 15, ne: 16, et: 17, sl: 19, pv: 20, ec: 21, ct: 22, is: 23, jr: 24, lm: 25, ez: 26, dn: 27,
  os: 28, jl: 29, am: 30, ob: 31, jn: 43, mq: 33, na: 34, hc: 35, sf: 36, ag: 37, zc: 38, ml: 39, mt: 40, mc: 41,
  lc: 42, jo: 43, at: 44, rm: 45, '1co': 46, '2co': 47, gl: 48, ef: 49, fp: 50, cl: 51, '1ts': 52, '2ts': 53,
  '1tm': 54, '2tm': 55, tt: 56, fm: 57, hb: 58, tg: 59, '1pe': 60, '2pe': 61, '1jo': 62, '2jo': 63, '3jo': 64,
  jd: 65, ap: 66,
};

const compactNames: string[][] = Array.from({ length: 66 }, (_, b) =>
  [osisBooks[b], booksPt[b], booksEn[b], booksEs[b]].map((a) => fold(a).replace(/[.\s]/g, '')),
);

/** Interpreta "João 3:16", "Jo 3.16", "Rm 8" ou "43:3:16". */
export function parseRef(text: string): Ref | null {
  const direct = fromId(text.trim());
  if (direct) return direct;
  const m = /^\s*(.+?)\s+(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?\s*$/u.exec(text);
  if (!m) return null;
  const name = fold(m[1]).replace(/[.\s]/g, '');
  const verse = m[3] ?? '1';
  if (m[1].trim().toLowerCase() === 'jó') return fromId(`18:${m[2]}:${verse}`);
  if (name in aliases) return fromId(`${aliases[name]}:${m[2]}:${verse}`);
  const matches = new Set<number>();
  const near = new Map<number, number>();
  for (let b = 0; b < 66; b++) {
    for (const n of compactNames[b]) {
      if (n === name || (name.length >= 2 && n.startsWith(name))) matches.add(b + 1);
      if (name.length >= 4) {
        const d = editDistance(n, name);
        if (d <= 2) near.set(b + 1, Math.min(near.get(b + 1) ?? 99, d));
      }
    }
  }
  if (matches.size === 0 && near.size > 0) {
    const best = Math.min(...near.values());
    for (const [b, d] of near) if (d === best) matches.add(b);
  }
  if (matches.size !== 1) return null;
  return fromId(`${[...matches][0]}:${m[2]}:${verse}`);
}

/** SM-2 idêntico ao ReviewSchedule do aplicativo original. */
export interface Schedule {
  repetitions: number;
  interval: number;
  ease: number;
  due: number;
}

export function review(old: Schedule, grade: number, now = new Date()): Schedule {
  if (grade < 0 || grade > 5) throw new RangeError('grade');
  const ease = Math.max(1.3, old.ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  const repetitions = grade < 3 ? 0 : old.repetitions + 1;
  const days =
    grade < 3 ? 1 : old.repetitions === 0 ? 1 : old.repetitions === 1 ? 6 : Math.max(1, Math.round(old.interval * old.ease));
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days).getTime();
  return { repetitions, interval: days, ease, due };
}

export function historicalYear(year: number): number {
  if (year === 0) throw new RangeError('No year zero');
  return year < 0 ? year + 1 : year;
}

/** Intervalo mínimo e máximo (anos) entre dois períodos; não existe ano zero. */
export function historicalInterval(
  aStart: number | null | undefined,
  aEnd: number | null | undefined,
  bStart: number | null | undefined,
  bEnd: number | null | undefined,
): [number, number] | null {
  if ([aStart, aEnd, bStart, bEnd].some((v) => v === null || v === undefined)) return null;
  const a = historicalYear(aStart!), b = historicalYear(aEnd!), c = historicalYear(bStart!), d = historicalYear(bEnd!);
  if (a > b || c > d) throw new RangeError('Reversed interval');
  return [a <= d && c <= b ? 0 : Math.min(Math.abs(c - b), Math.abs(a - d)), Math.max(Math.abs(d - a), Math.abs(c - b))];
}

export function geographicDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (n: number) => (n * Math.PI) / 180;
  const h = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export const yearLabel = (year: number | null | undefined) =>
  year === null || year === undefined ? 'Data não estabelecida' : year < 0 ? `${-year} a.C.` : `${year} d.C.`;

export function uuid(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
