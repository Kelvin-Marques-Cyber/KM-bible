// Lógica pura da área de estudos (lib/studies.dart, lib/religion_curricula.dart,
// lib/study_catalog.dart, lib/agostinho.dart) e dos devocionais. Sem React e
// sem acesso a rede: tudo aqui é testável isoladamente.
import type { DocumentRow, Study } from './content';
import { fold, fromId, refLabel, type Ref } from './domain';
import { referencesIn } from './scripture';

// ------------------------------------------------------------ catálogo (study_catalog.dart)
export const expandedTraditionTitles: Record<string, string> = {
  lutheran: 'Luterana confessional',
  anglican: 'Anglicana histórica',
  buddhism_mahayana: 'Budismo Mahayana',
  jainism: 'Jainismo',
  shinto: 'Xintoísmo',
  daoism: 'Taoismo / Daoismo',
  confucianism: 'Confucionismo',
  zoroastrianism: 'Zoroastrismo',
  eastern_orthodox: 'Ortodoxa oriental',
  methodist: 'Metodista',
  pentecostal: 'Pentecostal clássico',
  jehovahs_witnesses: 'Testemunhas de Jeová',
  latter_day_saints: 'Santos dos Últimos Dias',
  judaism: 'Judaísmo (fonte ortodoxa)',
  islam: 'Islã — cristologia',
  shia_islam: 'Islã xiita duodecimano',
  hinduism_vedanta: 'Hinduísmo — Vedanta',
  buddhism_theravada: 'Budismo Theravada',
  sikhism: 'Sikhismo',
  bahai: 'Fé Bahá’í',
  spiritism: 'Espiritismo kardecista',
  secular_humanism: 'Humanismo secular',
  umbanda: 'Umbanda (método de estudo)',
  candomble: 'Candomblé (método de estudo)',
  indigenous_traditions: 'Tradições indígenas (método de estudo)',
};

export const expandedTopicTitles: Record<string, string> = {
  origins: 'Introdução e história',
  sacred_texts: 'Textos sagrados e autoridade',
  ultimate_reality: 'Deus e realidade última',
  human_condition: 'O ser humano e sua condição',
  worship: 'Culto, ritos e comunidade',
  afterlife: 'Morte, juízo e esperança',
  creation: 'Criação e realidade',
  morality: 'Ética e valor humano',
  religion: 'Estudo das tradições',
  science: 'Ciência, filosofia e ateísmo',
};

/** topicTitles de lib/studies.dart (mesma ordem de inserção do mapa Dart). */
export const topicTitles: Record<string, string> = {
  ...expandedTopicTitles,
  sabbath: 'Sábado e Dia do Senhor',
  baptism: 'Batismo e aliança',
  salvation: 'Justificação e salvação',
  evil: 'O problema do mal',
  scripture: 'Escritura, fé e razão',
  resurrection: 'Ressurreição de Cristo',
  trinity: 'Trindade',
};

/** traditionTitles de lib/studies.dart (mesma ordem de inserção do mapa Dart). */
export const traditionTitles: Record<string, string> = {
  ...expandedTraditionTitles,
  presbyterian: 'Presbiteriana reformada',
  baptist: 'Batista confessional',
  seventh_day_adventist: 'Adventista do Sétimo Dia',
  roman_catholic: 'Católica romana',
  atheism: 'Ateísmo / objeções filosóficas',
};

export const traditionTitle = (target: string) => traditionTitles[target] ?? target;
export const topicTitle = (topic: string) => topicTitles[topic] ?? topic;

export const LEVEL_KEYS = ['beginner', 'intermediate', 'advanced'] as const;
export const levelKey = (level: number) => LEVEL_KEYS[Math.min(3, Math.max(1, level)) - 1];

/** Mesma ordem de Store.studies(): ORDER BY level, title (comparação binária do SQLite). */
export function sortStudies<T extends Pick<Study, 'level' | 'title'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.level - b.level || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}

export function filterStudies<T extends Pick<Study, 'level' | 'topic' | 'target'>>(
  rows: T[],
  filter: { topic?: string | null; target?: string | null; level?: number | null },
): T[] {
  return rows.filter(
    (s) =>
      (filter.topic == null || s.topic === filter.topic) &&
      (filter.target == null || s.target === filter.target) &&
      (filter.level == null || s.level === filter.level),
  );
}

// --------------------------------------------------- religiões (religion_curricula.dart)
export const religionFamilies: Record<string, string[]> = {
  Cristianismo: [
    'presbyterian',
    'roman_catholic',
    'eastern_orthodox',
    'lutheran',
    'anglican',
    'baptist',
    'methodist',
    'pentecostal',
    'seventh_day_adventist',
    'jehovahs_witnesses',
    'latter_day_saints',
  ],
  'Judaísmo, islã e Bahá’í': ['judaism', 'islam', 'shia_islam', 'bahai'],
  'Tradições da Índia': ['hinduism_vedanta', 'buddhism_theravada', 'buddhism_mahayana', 'sikhism', 'jainism'],
  'Leste da Ásia e tradição iraniana': ['shinto', 'daoism', 'confucianism', 'zoroastrianism'],
  'Brasil e tradições locais': ['spiritism', 'umbanda', 'candomble', 'indigenous_traditions'],
  'Cosmovisões não religiosas': ['atheism', 'secular_humanism'],
};

export interface TraditionEntry {
  target: string;
  title: string;
  count: number;
}

/** Tradições com estudos instalados, na ordem de traditionTitles, filtradas por família e texto. */
export function religionTargets(all: Pick<Study, 'target'>[], family: string, filter: string): TraditionEntry[] {
  const counts = new Map<string, number>();
  for (const s of all) counts.set(s.target, (counts.get(s.target) ?? 0) + 1);
  const q = fold(filter);
  const members = family ? religionFamilies[family] ?? [] : null;
  return Object.entries(traditionTitles)
    .filter(([key, title]) => counts.has(key) && (!members || members.includes(key)) && (!q || fold(title).includes(q)))
    .map(([target, title]) => ({ target, title, count: counts.get(target) ?? 0 }));
}

export const COURSE_TOPIC_ORDER = [
  'origins',
  'sacred_texts',
  'ultimate_reality',
  'human_condition',
  'salvation',
  'worship',
  'morality',
  'afterlife',
];

/** ReligionCoursePage: assuntos na ordem do currículo; desconhecidos ao final (estável). */
export function sortCourse<T extends Pick<Study, 'topic'>>(rows: T[]): T[] {
  const rank = (topic: string) => {
    const i = COURSE_TOPIC_ORDER.indexOf(topic);
    return i < 0 ? 100 : i;
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rank(a.row.topic) - rank(b.row.topic) || a.index - b.index)
    .map((x) => x.row);
}

// ---------------------------------------------------------------- fontes
export type Source = string | { title: string; url: string };

export function sourceLabel(source: Source): string {
  return typeof source === 'string' ? source : `${source.title}\n${source.url}`;
}
export function sourceUrl(source: Source): string | null {
  const url = typeof source === 'string' ? source.trim() : String(source.url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(url) ? url : null;
}
export function sourceTitle(source: Source): string {
  return typeof source === 'string' ? source : source.title || source.url;
}

// ------------------------------------------------------------------ estudo
/** Texto inicial da anotação criada a partir de um estudo (StudyPage do original). */
export const studyNoteBody = (id: string) => `Estudo: ${id}\n\n`;

/** Referências do estudo (identificadores livro:cap:vers válidos). */
export const studyRefs = (study: Pick<Study, 'refs'>): Ref[] =>
  study.refs.map((x) => fromId(x)).filter((r): r is Ref => r !== null);

/**
 * Divide Markdown longo em seções que começam em títulos (#…), para desenhar em
 * partes. Listas e tabelas nunca são cortadas ao meio (só se corta antes de títulos
 * fora de blocos de código).
 */
export function splitMarkdownSections(text: string, minLength = 600): string[] {
  const lines = text.split('\n');
  const sections: string[] = [];
  let current: string[] = [];
  let fence = false;
  const flush = () => {
    const chunk = current.join('\n').trim();
    if (chunk) sections.push(chunk);
    current = [];
  };
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^#{1,6}\s/.test(line) && current.join('\n').trim().length >= minLength) flush();
    current.push(line);
  }
  flush();
  return sections;
}

// ------------------------------------------------------------------ arena
export type Approach = 'presuppositional' | 'evidential' | 'exegetical';
export const APPROACHES: Approach[] = ['presuppositional', 'evidential', 'exegetical'];
export const STAGE_NAMES = ['Fundamentar', 'Responder', 'Debater'];
export const stageInstruction = (stage: number) =>
  stage === 1
    ? 'Formule uma tese e duas premissas.'
    : stage === 2
      ? 'Represente a posição interlocutora e responda com fontes.'
      : 'Inclua objeção forte, resposta e réplica possível.';

/** evaluate() do ArenaPage original: examina somente a estrutura textual. */
export function evaluateResponse(text: string, stage: number): string {
  const refs = referencesIn(text);
  const hasSource = text.includes('Westminster') || text.includes('https://') || text.includes('CFW');
  const results: string[] = [];
  results.push(
    text.length < 150
      ? 'Desenvolva premissas e conclusão em vez de uma afirmação isolada.'
      : 'Identifique quais frases são premissas e qual é a conclusão.',
  );
  results.push(
    refs.length === 0
      ? 'Inclua uma referência bíblica e explique seu contexto.'
      : `Referências encontradas: ${refs.map((r) => refLabel(r)).join(', ')}. Confira o contexto; a presença da referência não prova o argumento.`,
  );
  results.push(hasSource ? 'Confira se a fonte citada sustenta sua afirmação.' : 'Identifique uma fonte confessional ou histórica.');
  if (stage >= 2) results.push('Compare sua representação com a exposição descritiva do estudo.');
  if (stage >= 3) results.push('Apresente a objeção mais forte e uma resposta possível do interlocutor.');
  results.push('Esta verificação avalia estrutura textual. Não julga a verdade teológica da resposta.');
  return results.join('\n\n');
}

/** Anotação salva pelo laboratório (mesmo título, corpo e caderno do original). */
export function arenaNote(
  study: Pick<Study, 'id' | 'title'>,
  approachLabel: string,
  stage: number,
  response: string,
  feedback: string | null,
): { title: string; body: string; reference: string; notebook: string } {
  return {
    title: `Laboratório: ${study.title}`,
    body: `Abordagem: ${approachLabel}\nEtapa: ${stage}\n\n${response}\n\n${feedback ?? ''}`,
    reference: study.id,
    notebook: 'Laboratório',
  };
}
export const arenaProgressId = (studyId: string, stage: number) => `arena:${studyId}:${stage}`;

// -------------------------------------------------------------- apologistas
export interface Apologist {
  name: string;
  dates: string;
  text: string;
  works: string;
  source: string;
}
export const apologists: Apologist[] = [
  {
    name: 'Cornelius Van Til',
    dates: '1895–1987',
    text: 'Professor presbiteriano de apologética em Westminster. Enfatizou a dependência do conhecimento humano em relação a Deus, a antítese entre compromissos últimos e a crítica interna de cosmovisões. Sua abordagem pressuposicional difere do uso de argumentos como provas autossuficientes em terreno religiosamente neutro.',
    works: 'The Defense of the Faith; Christian Apologetics',
    source: 'https://www.wts.edu/',
  },
  {
    name: 'Greg L. Bahnsen',
    dates: '1948–1995',
    text: 'Apologista reformado associado ao pressuposicionalismo de Van Til. Desenvolveu aplicações ao debate e à análise das condições de conhecimento. Sua defesa transcendental exige examinar premissas e alternativas; a aplicação não deve ser reduzida a insultos contra o interlocutor.',
    works: 'Always Ready; Van Til’s Apologetic: Readings and Analysis',
    source: 'https://www.cmfnow.com/',
  },
  {
    name: 'Francis A. Schaeffer',
    dates: '1912–1984',
    text: 'Pensador presbiteriano e fundador de L’Abri. Relacionou fé, filosofia, arte e cultura e enfatizou diálogo atento às pessoas. Não deve ser tratado como simples reprodução metodológica de Van Til ou Bahnsen.',
    works: 'The God Who Is There; Escape from Reason; He Is There and He Is Not Silent',
    source: 'https://labri.org/',
  },
  {
    name: 'João Calvino',
    dates: '1509–1564',
    text: 'Reformador cuja teologia deu atenção ao conhecimento de Deus, à revelação e ao testemunho do Espírito. A tradição presbiteriana recebeu sua contribuição, sem identificar todas as práticas históricas de Genebra com normas permanentes para o presente.',
    works: 'Institutas da Religião Cristã; comentários bíblicos',
    source: 'https://www.ccel.org/ccel/calvin/institutes.html',
  },
  {
    name: 'Herman Bavinck',
    dates: '1854–1921',
    text: 'Teólogo reformado neerlandês. Tratou revelação, criação, conhecimento e vida cristã em relação orgânica. Sua dogmática dialoga com a filosofia de seu tempo e contribui para a reflexão apologética sem dissolver a identidade confessional.',
    works: 'Reformed Dogmatics; Philosophy of Revelation',
    source: 'https://www.ccel.org/ccel/bavinck/revelation.html',
  },
  {
    name: 'Alvin Plantinga',
    dates: 'n. 1932',
    text: 'Filósofo ligado à epistemologia reformada. Investigou garantia, função adequada e crença básica. Essa linha deve ser distinguida do pressuposicionalismo de Van Til. Um modelo de garantia não é, por si só, uma demonstração histórica do cristianismo.',
    works: 'God and Other Minds; Warranted Christian Belief',
    source: 'https://global.oup.com/academic/product/warranted-christian-belief-9780195131932',
  },
];

// ------------------------------------------------------------- confissões
export const CONFESSION_TABS: [string, string][] = [
  ['WCF', 'Confissão · 33'],
  ['WSC', 'Breve · 107'],
  ['WLC', 'Maior · 196'],
  ['AUG', 'Agostinho · 13 livros'],
];

export const docNumber = (d: Pick<DocumentRow, 'metadata'>) => {
  const n = Number(d.metadata?.number);
  return Number.isFinite(n) ? n : 0;
};

/** Ordem por metadata.number (como o original); empates mantêm a ordem recebida. */
export function sortByNumber<T extends Pick<DocumentRow, 'metadata'>>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => docNumber(a.row) - docNumber(b.row) || a.index - b.index)
    .map((x) => x.row);
}

/** Texto pesquisável (já sem acentos) de um item: título, corpo e corpo em português. */
export const confessionHaystack = (d: Pick<DocumentRow, 'title' | 'body' | 'pt'>) => fold(`${d.title} ${d.body} ${d.pt?.body ?? ''}`);

/** Rótulos das referências de metadata.references, separados por " · ". */
export function referenceLabels(d: Pick<DocumentRow, 'metadata'>, language: string): string {
  const refs = Array.isArray(d.metadata?.references) ? (d.metadata.references as unknown[]) : [];
  return refs
    .map((x) => {
      const r = fromId(String(x));
      return r ? refLabel(r, language) : String(x);
    })
    .join(' · ');
}

// -------------------------------------------------------------- Agostinho
export const AUGUSTINE_EDITION_URL = 'https://www.solusagape.com.br/obras-milenares/confiss%C3%B5es';
export const AUGUSTINE_INDEX_CREDITS =
  'Tradução de J. Oliveira Santos e A. Ambrósio de Pina. Edição Solus Ágape / Valdemar Teodoro Editor (2024), distribuída com atribuição conforme os créditos.';

/** Índice de leitura (misc/agostinho-confissoes-facil.json), embutido para funcionar sem rede. */
export const AUGUSTINE_BOOKS: { number: number; title: string; chapterCount: number }[] = [
  { number: 1, title: 'A infância e o coração inquieto', chapterCount: 20 },
  { number: 2, title: 'A adolescência e o roubo das peras', chapterCount: 10 },
  { number: 3, title: 'Cartago, ambições e falsas respostas', chapterCount: 12 },
  { number: 4, title: 'A amizade, a perda e a dor', chapterCount: 16 },
  { number: 5, title: 'De Cartago a Milão', chapterCount: 14 },
  { number: 6, title: 'Entre a verdade e a indecisão', chapterCount: 16 },
  { number: 7, title: 'A verdade, a alma e a origem do mal', chapterCount: 21 },
  { number: 8, title: 'A conversão no jardim', chapterCount: 12 },
  { number: 9, title: 'O batismo e a despedida de Mônica', chapterCount: 13 },
  { number: 10, title: 'Memória, desejo e conhecimento de si', chapterCount: 43 },
  { number: 11, title: 'O tempo e a eternidade', chapterCount: 31 },
  { number: 12, title: 'Como interpretar a criação', chapterCount: 32 },
  { number: 13, title: 'A criação e o descanso em Deus', chapterCount: 38 },
];
export const augustineBookTitle = (bookNumber: number) => AUGUSTINE_BOOKS[bookNumber - 1]?.title ?? '';

/** Valida o índice integral como o original (13 livros e 278 capítulos). */
export const validAugustineCounts = (counts: unknown, total: unknown): counts is number[] =>
  Array.isArray(counts) && counts.length === 13 && total === 278 && counts.every((n) => Number.isInteger(n) && n > 0);

/** Posição (base 0) limitada ao índice. */
export function clampPosition(counts: number[], book: number, chapter: number): [number, number] {
  const b = Math.min(counts.length - 1, Math.max(0, Math.trunc(Number.isFinite(book) ? book : 0)));
  const c = Math.min(counts[b] - 1, Math.max(0, Math.trunc(Number.isFinite(chapter) ? chapter : 0)));
  return [b, c];
}

/** Anterior/Próximo atravessando livros; null nas extremidades. */
export function stepPosition(counts: number[], book: number, chapter: number, direction: -1 | 1): [number, number] | null {
  if (direction < 0) {
    if (chapter > 0) return [book, chapter - 1];
    if (book > 0) return [book - 1, counts[book - 1] - 1];
    return null;
  }
  if (chapter + 1 < counts[book]) return [book, chapter + 1];
  if (book + 1 < counts.length) return [book + 1, 0];
  return null;
}

export const augustineBookmarkKey = (book: number, chapter: number) => `agostinho_favorito_${book + 1}_${chapter + 1}`;

/** Texto copiado do capítulo, com os créditos exigidos pela edição. */
export const augustineCopyText = (book: number, chapter: number, body: string) =>
  `Confissões de Santo Agostinho — Livro ${book + 1}, capítulo ${chapter + 1}\n\n${body}\n\nTradução: J. Oliveira Santos e A. Ambrósio de Pina. Fonte: Solus Ágape.`;

export function augustineCredits(meta: Record<string, unknown>): string {
  return `Fonte: ${String(meta.source ?? '')}\nTradução: ${String(meta.translator ?? '')}\nEdição: ${String(meta.edition ?? '')}\n${String(meta.license ?? '')}`;
}

/** Parágrafos separados por linhas em branco. */
export const paragraphs = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export interface TextPiece {
  text: string;
  note?: boolean;
}
/**
 * Marca como sobrescrito as chamadas de nota escritas com algarismos comuns
 * ("pregue?5", "buscarem6.") quando o número existe nas notas da edição.
 * Sobrescritos Unicode (¹²³) já vêm no texto e são preservados como estão.
 */
export function footnotePieces(paragraph: string, numbers: ReadonlySet<number>): TextPiece[] {
  if (numbers.size === 0) return [{ text: paragraph }];
  const out: TextPiece[] = [];
  const pattern = /([\p{L}?!.,;:"»”’)…])(\d{1,3})(?=[\s.,;:!?"»”’)…]|$)/gu;
  let cursor = 0;
  for (const m of paragraph.matchAll(pattern)) {
    const n = Number(m[2]);
    if (!numbers.has(n)) continue;
    const start = (m.index ?? 0) + m[1].length;
    if (start > cursor) out.push({ text: paragraph.slice(cursor, start) });
    out.push({ text: m[2], note: true });
    cursor = start + m[2].length;
  }
  if (cursor < paragraph.length) out.push({ text: paragraph.slice(cursor) });
  return out.length ? out : [{ text: paragraph }];
}

// --------------------------------------------------------------- devocionais
export interface KnownCollection {
  name: [string, string, string];
  calendar: boolean;
}
/** Coleções conhecidas: nome de exibição e se a leitura de hoje segue o calendário. */
export const KNOWN_DEVOTIONALS: Record<string, KnownCollection> = {
  'EXP-SPURGEON-DIARIO': { name: ['Café da Manhã com Spurgeon', 'Morning with Spurgeon', 'Desayuno con Spurgeon'], calendar: true },
  'EXP-JORNADA-DIARIO': { name: ['Jornada Reformada', 'Reformed Journey', 'Jornada Reformada'], calendar: false },
};

export interface ModuleLike {
  id: string;
  title: string;
  kind: string;
  metadata: Record<string, unknown>;
}

/** Módulo de documentos que é uma coleção devocional (inclui pacotes importados no futuro). */
export function isDevotionalCollection(m: ModuleLike): boolean {
  if (KNOWN_DEVOTIONALS[m.id] || m.kind === 'devotional') return true;
  if (typeof m.metadata?.days === 'number') return true;
  const title = fold(m.title ?? '');
  return title.includes('devocion') || title.includes('diario');
}

/** Nome curto para os cartões (remove o sufixo " — abrir por …" dos títulos de catálogo). */
export function collectionName(m: Pick<ModuleLike, 'id' | 'title'>, language: 'pt' | 'en' | 'es' = 'pt'): string {
  const known = KNOWN_DEVOTIONALS[m.id];
  if (known) return known.name[language === 'en' ? 1 : language === 'es' ? 2 : 0];
  return m.title.replace(/\s+—\s+abrir por .*$/i, '').trim() || m.title;
}

const LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
/**
 * Dia do ano no calendário bissexto (1–366): 29/02 = 60 e 01/03 = 61 em qualquer
 * ano. Assim o devocional de 29 de fevereiro só aparece nesse dia.
 */
export const leapDayOfYear = (month0: number, day: number) => LEAP_CUMULATIVE[month0] + day;
export const todayLeapDay = (date = new Date()) => leapDayOfYear(date.getMonth(), date.getDate());

function parseMonthDay(value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null;
  let m = /^(?:\d{4}-)?(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (m) return [Number(m[1]), Number(m[2])];
  m = /^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/.exec(value.trim());
  if (m) return [Number(m[2]), Number(m[1])];
  return null;
}

function dateDay(meta: Record<string, unknown>): number | null {
  const md = parseMonthDay(meta.date) ?? (Number.isInteger(meta.month) && Number.isInteger(meta.day) ? [Number(meta.month), Number(meta.day)] : null);
  return md && md[0] >= 1 && md[0] <= 12 && md[1] >= 1 && md[1] <= 31 ? leapDayOfYear(md[0] - 1, md[1]) : null;
}

function numeric(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Ordem declarada do documento (date_order, order ou a data), quando houver. */
export function declaredOrder(d: Pick<DocumentRow, 'metadata'>): number | null {
  const meta = d.metadata ?? {};
  return numeric(meta.date_order) ?? numeric(meta.order) ?? dateDay(meta);
}

/**
 * Dia do calendário bissexto (1–366) de um documento: pela data (MM-DD, DD/MM,
 * month/day) ou pela ordem do dia; coleções de 365 dias pulam o 29/02.
 */
export function calendarDay(d: Pick<DocumentRow, 'metadata'>, collectionSize: number): number | null {
  const meta = d.metadata ?? {};
  const byDate = dateDay(meta);
  if (byDate !== null) return byDate;
  const order = numeric(meta.date_order);
  if (order === null || !Number.isInteger(order) || order < 1 || order > 366) return null;
  return collectionSize === 365 && order >= 60 ? order + 1 : order;
}

/** Ordem de leitura: ordem declarada; documentos sem ordem ficam na ordem recebida, ao final. */
export function sortDevotionals<T extends Pick<DocumentRow, 'metadata' | 'id'>>(docs: T[]): T[] {
  return docs
    .map((d, index) => ({ d, index, order: declaredOrder(d) }))
    .sort((a, b) => (a.order ?? 1e9 + a.index) - (b.order ?? 1e9 + b.index) || a.index - b.index)
    .map((x) => x.d);
}

/** A coleção segue o calendário (um texto por dia do ano)? */
export function isCalendarCollection(moduleId: string, docs: Pick<DocumentRow, 'metadata'>[]): boolean {
  const known = KNOWN_DEVOTIONALS[moduleId];
  if (known) return known.calendar;
  return docs.length >= 365 && docs.length <= 366 && docs.every((d) => calendarDay(d, docs.length) !== null);
}

/** Índice da leitura de hoje numa coleção por calendário (a última anterior, se faltar o dia). */
export function todayIndex(docs: Pick<DocumentRow, 'metadata'>[], date = new Date()): number {
  const today = todayLeapDay(date);
  let exact = -1;
  let before = -1;
  let beforeDay = -1;
  docs.forEach((d, i) => {
    const day = calendarDay(d, docs.length);
    if (day === null) return;
    if (day === today) {
      if (exact < 0) exact = i;
    } else if (day < today && day > beforeDay) {
      before = i;
      beforeDay = day;
    }
  });
  return exact >= 0 ? exact : before >= 0 ? before : 0;
}

/** Primeira leitura ainda não marcada; se todas foram lidas, a primeira. */
export function firstUnreadIndex(docs: Pick<DocumentRow, 'id'>[], isRead: (docId: string) => boolean): number {
  const index = docs.findIndex((d) => !isRead(d.id));
  return index >= 0 ? index : 0;
}

export const devotionalProgressId = (docId: string) => `devocional:${docId}`;
export const devotionalLastKey = (moduleId: string) => `devocional_ultimo_${moduleId}`;

/** Título sem o nome da coleção ("Café da manhã com Spurgeon — 01/01: Graça…" → "01/01: Graça…"). */
export function shortTitle(title: string): string {
  const i = title.indexOf(' — ');
  const rest = i >= 0 ? title.slice(i + 3).trim() : title.trim();
  return rest ? rest.charAt(0).toLocaleUpperCase('pt-BR') + rest.slice(1) : title;
}

/** Texto copiado de uma leitura devocional com os créditos do módulo. */
export function devotionalCopyText(
  doc: Pick<DocumentRow, 'id' | 'title' | 'body'>,
  m: { author?: string; title?: string; source?: string; license?: string } | null | undefined,
): string {
  const credit = `${m?.author ?? ''}; ${m?.title ?? ''}; ${doc.id}; ${m?.source ?? ''}`;
  return `${doc.title}\n\n${doc.body}\n\n${credit}${m?.license ? `\n${m.license}` : ''}`;
}

/** Texto pesquisável de uma leitura (título + corpo, sem acentos). */
export const devotionalHaystack = (d: Pick<DocumentRow, 'title' | 'body'>) => fold(`${d.title} ${d.body}`);
