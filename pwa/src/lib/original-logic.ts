// Lógica pura do idioma original (lib/linguistics.dart): decodificação de
// morfologia OSHB/Robinson, normalização de formas hebraicas/gregas e o
// índice de pesquisa usado tanto pelo Web Worker quanto pelo fallback em
// fatias ociosas na thread principal. Sem dependências de DOM, catálogo ou
// IndexedDB, para poder ser empacotado no worker.

// ----------------------------------------------------------------- morfologia
const OSHB_PARTS: Record<string, string> = {
  N: 'substantivo',
  V: 'verbo',
  A: 'adjetivo',
  P: 'pronome',
  R: 'preposição',
  C: 'conjunção',
  D: 'advérbio',
  T: 'partícula',
  S: 'sufixo',
};
const GREEK_PARTS: Record<string, string> = {
  N: 'substantivo',
  V: 'verbo',
  A: 'adjetivo',
  D: 'advérbio',
  P: 'pronome pessoal',
  R: 'pronome relativo',
  T: 'artigo',
  PREP: 'preposição',
  CONJ: 'conjunção',
  ADV: 'advérbio',
};
const TENSE: Record<string, string> = {
  P: 'presente',
  I: 'imperfeito',
  F: 'futuro',
  A: 'aoristo',
  R: 'perfeito',
  L: 'mais-que-perfeito',
};
const VOICE: Record<string, string> = {
  A: 'ativa',
  M: 'média',
  P: 'passiva',
  E: 'média/passiva',
  D: 'média deponente',
  O: 'passiva deponente',
  N: 'média/passiva deponente',
};
const MOOD: Record<string, string> = {
  I: 'indicativo',
  S: 'subjuntivo',
  O: 'optativo',
  M: 'imperativo',
  N: 'infinitivo',
  P: 'particípio',
};
const CASES: Record<string, string> = { N: 'nominativo', G: 'genitivo', D: 'dativo', A: 'acusativo', V: 'vocativo' };
const NUMBER: Record<string, string> = { S: 'singular', P: 'plural' };
const GENDER: Record<string, string> = { M: 'masculino', F: 'feminino', N: 'neutro' };

/** Códigos Robinson que começam com A/H mas não são OSHB (adjetivos, advérbios, palavras hebraicas/aramaicas no NT). */
const ROBINSON_AH = new Set(['ADV', 'ARAM', 'HEB']);

/**
 * Código OSHB (H = hebraico, A = aramaico)? O original testava apenas a letra
 * inicial, o que classificava adjetivos gregos ("A-ASM") e "ADV" como aramaico.
 * Códigos OSHB nunca contêm hífen; os Robinson com A/H iniciais têm hífen ou
 * estão em ROBINSON_AH.
 */
export function isOshbCode(raw: string): boolean {
  return (raw.startsWith('H') || raw.startsWith('A')) && !raw.includes('-') && !ROBINSON_AH.has(raw);
}

/** morphology(raw) de lib/linguistics.dart: OSHB (AT) ou Robinson (NT), rótulos em português. */
export function morphology(raw: string): string {
  if (isOshbCode(raw)) {
    const language = raw.startsWith('A') ? 'Aramaico' : 'Hebraico';
    const decoded = raw
      .substring(1)
      .split('/')
      .map((s) => (s === '' ? '' : OSHB_PARTS[s[0]] ?? s))
      .join(' + ');
    return `${language} · ${decoded} · código OSHB: ${raw}`;
  }
  const fields = raw.split('-');
  const decoded: string[] = [GREEK_PARTS[fields[0]] ?? fields[0]];
  if (fields[0] === 'V' && fields.length > 1) {
    const code = fields[1].replace('2', '');
    if (code.length >= 3) {
      decoded.push(TENSE[code[0]] ?? code[0], VOICE[code[1]] ?? code[1], MOOD[code[2]] ?? code[2]);
    }
    if (fields.length > 2) {
      const person = fields[2];
      if (/^[123][SP]$/.test(person)) decoded.push(`${person[0]}ª pessoa, ${person[1] === 'S' ? 'singular' : 'plural'}`);
      else decoded.push(`Flexão: ${person}`);
    }
  } else if (fields.length > 1) {
    const code = fields[1];
    if (code.length >= 3) decoded.push(CASES[code[0]] ?? code[0], NUMBER[code[1]] ?? code[1], GENDER[code[2]] ?? code[2]);
    else decoded.push(code);
  }
  return `${decoded.join(' · ')}\nCódigo Robinson: ${raw}`;
}

// ----------------------------------------------------------- normalização
const FINAL_FORMS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ', ς: 'σ' };
// Marcas (sinais vocálicos, cantilação, acentos e espíritos gregos), pontuação
// (maqaf, sof pasuq, "/" das divisões de morfemas da OSHB), formatação,
// espaços e os sinais de álefe/áin usados nas transliterações.
const STRIP = /[\p{M}\p{P}\p{Cf}\p{Cc}\sʻʼʾʿ'`´]/gu;
const FINALS = /[ךםןףץς]/g;

/** fold() para o original: sem sinais vocálicos, cantilação, acentos, pontuação e formas finais. */
export function foldOriginal(s: string): string {
  return s
    .normalize('NFD')
    .replace(STRIP, '')
    .toLowerCase()
    .replace(FINALS, (c) => FINAL_FORMS[c] ?? c);
}

/** Mesmo balde de lexicon/l|o/<balde>.json usado por content.ts. */
export function lexBucket(id: string): string {
  const m = /^([A-Za-z]+)(\d+)/.exec(id);
  return m ? `${m[1].toUpperCase()}${Math.floor(Number(m[2]) / 250)}` : 'x';
}

// ------------------------------------------------------- fatias de tempo
export type Pause = () => Promise<void>;

/** Cede a thread principal (ocioso quando possível) entre fatias de trabalho. */
export const idlePause: Pause = () =>
  new Promise<void>((resolve) => {
    const g = globalThis as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number };
    if (typeof g.requestIdleCallback === 'function') g.requestIdleCallback(() => resolve(), { timeout: 60 });
    else setTimeout(resolve, 0);
  });

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Executa trabalho em fatias de ~budget ms, cedendo entre elas (sem pausa: síncrono, p. ex. no worker). */
export function slicer(pause?: Pause, budget = 8) {
  let start = now();
  return async () => {
    if (!pause || now() - start < budget) return;
    await pause();
    start = now();
  };
}

// --------------------------------------------------------------- índice
export const FIELD_SEPARATOR = '\u0001';

/** Nível de correspondência: 0 igual, 1 começa com, 2 contém, -1 nenhum (campos separados por FIELD_SEPARATOR). */
export function matchTier(key: string, q: string): number {
  let best = -1;
  for (const field of key.split(FIELD_SEPARATOR)) {
    if (field === q) return 0;
    if (field.startsWith(q)) best = 1;
    else if (best === -1 && field.includes(q)) best = 2;
  }
  return best;
}

/**
 * Filtra chaves já normalizadas: iguais primeiro, depois prefixos, depois
 * substrings, preservando a ordem original (frequência ou número Strong).
 */
export async function rankKeys(keys: string[], q: string, limit: number, pause?: Pause): Promise<{ total: number; indices: number[] }> {
  const tiers: number[][] = [[], [], []];
  let total = 0;
  if (!q) return { total, indices: [] };
  const step = slicer(pause);
  for (let i = 0; i < keys.length; i++) {
    if ((i & 2047) === 2047) await step();
    const key = keys[i];
    if (!key.includes(q)) continue;
    const tier = matchTier(key, q);
    if (tier < 0) continue;
    total++;
    if (tiers[tier].length < limit) tiers[tier].push(i);
  }
  return { total, indices: [...tiers[0], ...tiers[1], ...tiers[2]].slice(0, limit) };
}

export type IndexDataset = 'surfaces' | 'lexemes';
export interface IndexRequest {
  dataset: IndexDataset;
  url: string;
  query: string;
  limit: number;
}
export interface IndexResult {
  total: number;
  rows: unknown[][];
}
export type IndexProgress = { phase: 'download' } | { phase: 'index'; value: number };

/** Erro de carregamento serializável (worker → thread principal). */
export class IndexLoadError extends Error {
  constructor(
    message: string,
    public kind: 'offline' | 'missing' | 'http',
    public url: string,
  ) {
    super(message);
    this.name = 'IndexLoadError';
  }
}

/** surfaces.json: [forma, lema, n]; list.json: [id, lema, transliteração, glosa]. */
export function indexKey(dataset: IndexDataset, row: unknown[]): string {
  if (dataset === 'surfaces') return foldOriginal(String(row[0] ?? ''));
  return `${foldOriginal(String(row[1] ?? ''))}${FIELD_SEPARATOR}${foldOriginal(String(row[2] ?? ''))}`;
}

interface Built {
  rows: unknown[][];
  keys: string[];
}

/**
 * Serviço de índice: baixa a lista uma vez, normaliza as chaves (em fatias,
 * com progresso) e responde consultas. O worker o usa sem pausas; o fallback
 * da thread principal passa idlePause.
 */
export function createIndexService(load: (url: string) => Promise<unknown>, pause?: Pause) {
  interface Entry {
    url: string;
    promise: Promise<Built>;
    listeners: Set<(p: IndexProgress) => void>;
  }
  const built = new Map<IndexDataset, Entry>();

  async function build(dataset: IndexDataset, url: string, emit: (p: IndexProgress) => void): Promise<Built> {
    emit({ phase: 'download' });
    const data = await load(url);
    if (!Array.isArray(data)) throw new IndexLoadError('Índice inválido.', 'http', url);
    const rows = data as unknown[][];
    const keys = new Array<string>(rows.length);
    const step = slicer(pause);
    let reported = -1;
    for (let i = 0; i < rows.length; i++) {
      keys[i] = indexKey(dataset, rows[i]);
      if ((i & 1023) === 1023) {
        const value = Math.floor((i / rows.length) * 20) / 20;
        if (value !== reported) {
          reported = value;
          emit({ phase: 'index', value });
        }
        await step();
      }
    }
    emit({ phase: 'index', value: 1 });
    return { rows, keys };
  }

  function ensure(dataset: IndexDataset, url: string, onProgress?: (p: IndexProgress) => void): Promise<Built> {
    let entry = built.get(dataset);
    if (!entry || entry.url !== url) {
      const current: Entry = { url, listeners: new Set(), promise: Promise.resolve({ rows: [], keys: [] }) };
      if (onProgress) current.listeners.add(onProgress);
      built.set(dataset, current);
      current.promise = build(dataset, url, (p) => current.listeners.forEach((l) => l(p)));
      current.promise.catch(() => {
        if (built.get(dataset) === current) built.delete(dataset);
      });
      entry = current;
    } else if (onProgress) {
      entry.listeners.add(onProgress);
    }
    if (onProgress) {
      const listeners = entry.listeners;
      const done = () => listeners.delete(onProgress);
      entry.promise.then(done, done);
    }
    return entry.promise;
  }

  return {
    async query(request: IndexRequest, onProgress?: (p: IndexProgress) => void): Promise<IndexResult> {
      const q = foldOriginal(request.query);
      if (!q) return { total: 0, rows: [] };
      const index = await ensure(request.dataset, request.url, onProgress);
      const { total, indices } = await rankKeys(index.keys, q, request.limit, pause);
      return { total, rows: indices.map((i) => index.rows[i]) };
    },
    /** Libera a memória do índice (p. ex. quando a tela é fechada). */
    clear() {
      built.clear();
    },
  };
}

// ----------------------------------------------------- protocolo do worker
export type WorkerRequest = IndexRequest & { id: number };
export type WorkerMessage =
  | ({ id: number; type: 'progress' } & IndexProgress)
  | ({ id: number; type: 'result' } & IndexResult)
  | { id: number; type: 'error'; message: string; kind?: IndexLoadError['kind']; url?: string };

/** Morfologia: pesquisa sem diferenciar maiúsculas (como LIKE do SQLite), iguais e prefixos primeiro. */
export function rankMorphCodes(list: [string, number][], query: string): { codes: [string, number][]; corpus: number } {
  const q = query.trim().toLowerCase();
  if (!q) return { codes: [], corpus: 0 };
  const tiers: [string, number][][] = [[], [], []];
  let corpus = 0;
  for (const item of list) {
    const code = item[0].toLowerCase();
    if (!code.includes(q)) continue;
    corpus += item[1];
    tiers[code === q ? 0 : code.startsWith(q) ? 1 : 2].push(item);
  }
  return { codes: [...tiers[0], ...tiers[1], ...tiers[2]], corpus };
}
