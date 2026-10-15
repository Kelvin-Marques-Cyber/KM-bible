// Núcleo da pesquisa geral (lib/search-core.ts): consulta, interseção e
// decodificação das postagens com um índice sintético minúsculo, no mesmo
// formato de scripts/build_data.py (build_index).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fnv1a, tokenize } from '../../src/lib/domain';
import {
  cleanSnippet,
  combine,
  createSearchService,
  decodeDeltas,
  groupOf,
  highlightParts,
  intersectAll,
  intersectSorted,
  isEmptyQuery,
  LIMITS,
  mergeHits,
  NETWORK_BUDGET,
  parseQuery,
  recordHit,
  SearchLoadError,
  shardOf,
  snippet,
  titleFirst,
  TokenIndexBuilder,
  tokensMatch,
  unionSorted,
  type BibleSection,
  type IndexSpec,
  type RecordSection,
  type SearchHit,
  type SearchLoaders,
  type SearchRecord,
  type SearchRequest,
  type Segment,
  type SectionResult,
} from '../../src/lib/search-core';

// ----------------------------------------------------------- índice sintético
const BASE = 'https://exemplo.test/data/v1/search/mini/';
const VERSION = 'abc123';

/** Porta de build_index() do Python: postagens delta por fragmento e blocos de registros. */
function buildIndex(records: SearchRecord[], texts: string[], shards: number, chunk: number) {
  const files = new Map<string, unknown>();
  const postings = new Map<number, Map<string, number[]>>();
  texts.forEach((text, index) => {
    for (const token of new Set(tokenize(text))) {
      const shard = shardOf(token, shards);
      if (!postings.has(shard)) postings.set(shard, new Map());
      const table = postings.get(shard)!;
      if (!table.has(token)) table.set(token, []);
      table.get(token)!.push(index);
    }
  });
  for (const [shard, table] of postings) {
    const encoded: Record<string, number[]> = {};
    for (const [token, ids] of table) {
      let previous = 0;
      encoded[token] = ids.map((v) => {
        const d = v - previous;
        previous = v;
        return d;
      });
    }
    files.set(`${BASE}p/${shard}.json?v=${VERSION}`, encoded);
  }
  for (let start = 0; start < records.length; start += chunk) {
    files.set(`${BASE}r/${start / chunk}.json?v=${VERSION}`, records.slice(start, start + chunk));
  }
  return files;
}

// Disposição como a de search/general: temas, documentos por módulo, estudos e léxico.
const RECORDS: [SearchRecord, string][] = [
  [['topic', 't1', 'Amor de Deus', 'O amor eterno…', 'Torrey', ''], 'Amor de Deus o amor eterno'],
  [['topic', 't2', 'Fé', 'A fé e a graça de Deus', 'Torrey', ''], 'Fé a fé e a graça de Deus'],
  [['topic', 't3', 'Graça', 'Favor imerecido', 'Torrey', ''], 'Graça favor imerecido de Deus'],
  [['confession', 'WCF.1', 'Da Escritura Sagrada', 'A luz da natureza', 'A', '19:19:1'], 'Da Escritura Sagrada a luz da natureza e a graça'],
  [['confession', 'WCF.2', 'De Deus', 'Há um só Deus', 'A', ''], 'De Deus há um só Deus vivo e verdadeiro'],
  [['place', 'CTX.1', 'Jerusalém', 'Cidade de Davi', 'B', ''], 'Jerusalém cidade de Davi graça'],
  [['studies', 's1', 'Graça comum', 'A graça comum de Deus', 'Apologética reformada', ''], 'Graça comum a graça comum de Deus'],
  [['lexicon', 'G5485', 'G5485 · χάρις', 'graça, favor', 'Strong', ''], 'G5485 χάρις charis graça favor'],
  [['lexicon', 'H2580', 'H2580 · חֵן', 'graça, favor', 'Strong', ''], 'H2580 חֵן chen graça favor'],
];
const records = RECORDS.map(([r]) => r);
const texts = RECORDS.map(([, t]) => t);
const SHARDS = 4;
const CHUNK = 2;

const segments = (allowed: Set<string>): Segment[] => [
  { start: 0, end: 3, group: 'topic', allowed: true },
  { start: 3, end: 5, group: 'documents', module: 'A', allowed: allowed.has('A') },
  { start: 5, end: 6, group: 'documents', module: 'B', allowed: allowed.has('B') },
  { start: 6, end: 7, group: 'studies', allowed: true },
  { start: 7, end: 9, group: 'lexicon', allowed: true },
];

function spec(allowed: string[], overrides: Partial<IndexSpec> = {}): IndexSpec {
  return {
    name: 'general',
    base: BASE,
    version: VERSION,
    shards: SHARDS,
    records: records.length,
    chunk: CHUNK,
    segments: segments(new Set(allowed)),
    allowed,
    limits: { topic: LIMITS.topic, documents: LIMITS.documents, studies: LIMITS.studies, lexicon: LIMITS.lexicon },
    ...overrides,
  };
}

function loaders(files: Map<string, unknown>, options: { offline?: Set<string>; cached?: Set<string>; log?: string[] } = {}): SearchLoaders {
  return {
    async json(url) {
      options.log?.push(url);
      if (options.offline?.has(url)) throw new SearchLoadError('offline', url);
      if (!files.has(url)) throw new SearchLoadError('missing', url);
      return structuredClone(files.get(url));
    },
    isCached: async (url) => options.cached?.has(url) ?? false,
    userData: async () => null,
  };
}

function request(text: string, indexes: IndexSpec[], extra: Partial<SearchRequest> = {}): SearchRequest {
  return { text, query: parseQuery(text), bible: null, indexes, user: [], deep: false, ...extra };
}

async function run(service: ReturnType<typeof createSearchService>, req: SearchRequest) {
  const sections: SectionResult[] = [];
  const progress: [number, number][] = [];
  await service.run(req, { cancelled: () => false, section: (s) => sections.push(s), progress: (d, t) => progress.push([d, t]) });
  return { sections, progress };
}

const ids = (section: SectionResult | undefined, group: string) =>
  ((section as RecordSection | undefined)?.groups[group as 'topic'] ?? []).map((h) => h.r[1]);

// ---------------------------------------------------------------- consulta
describe('parseQuery / tokensMatch (FTS5 AND + prefixo no último termo)', () => {
  it('separa termos exatos e o prefixo do último termo com 3+ letras', () => {
    expect(parseQuery('Graça e PAZ')).toEqual({ exact: ['graca', 'e'], prefix: 'paz', terms: ['graca', 'e', 'paz'] });
    expect(parseQuery('amor de')).toEqual({ exact: ['amor', 'de'], prefix: null, terms: ['amor', 'de'] });
    expect(isEmptyQuery(parseQuery('  ¿!  '))).toBe(true);
  });

  it('lê no máximo 300 caracteres, como fts() do original', () => {
    const q = parseQuery(`${'a '.repeat(150)}zebra`);
    expect(q.terms).toEqual(['a']);
    expect(q.terms).not.toContain('zebra');
  });

  it('exige todos os termos como palavras inteiras; o último também por prefixo', () => {
    const tokens = new Set(tokenize('Porque Deus amou o mundo de tal maneira'));
    expect(tokensMatch(tokens, parseQuery('deus mundo'))).toBe(true);
    expect(tokensMatch(tokens, parseQuery('deus mund'))).toBe(true);
    expect(tokensMatch(tokens, parseQuery('deu mundo'))).toBe(false);
    expect(tokensMatch(tokens, parseQuery('mundo ma'))).toBe(false);
    expect(tokensMatch(tokens, parseQuery('ceu'))).toBe(false);
  });
});

describe('destaque e trechos', () => {
  it('marca palavras com e sem acento, inclusive pelo prefixo', () => {
    const parts = highlightParts('A graça de Deus é graciosa.', parseQuery('graca gracio'));
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['graça', 'graciosa']);
    expect(parts.map((p) => p.text).join('')).toBe('A graça de Deus é graciosa.');
    expect(highlightParts('nada', parseQuery(''))).toEqual([{ text: 'nada', hit: false }]);
  });

  it('remove destinos de links internos e limita como snippet() do Python', () => {
    expect(cleanSnippet('Números 20:5(biblia:4:20:5) Canaã…')).toBe('Números 20:5 Canaã…');
    const long = `${'palavra '.repeat(40)}fim`;
    const s = snippet(long);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(201);
    expect(snippet('**negrito** [link]')).toBe('negrito link');
  });
});

// ------------------------------------------------------------- postagens
describe('postagens delta e interseção', () => {
  it('decodifica diferenças sucessivas a partir de 0', () => {
    expect(Array.from(decodeDeltas([3, 2, 5, 1]))).toEqual([3, 5, 10, 11]);
    expect(Array.from(decodeDeltas([]))).toEqual([]);
  });

  it('intersecta e une listas ordenadas', () => {
    expect(Array.from(intersectSorted([1, 3, 5, 9], [2, 3, 9, 10]))).toEqual([3, 9]);
    expect(Array.from(intersectAll([[1, 2, 3, 4, 5], [2, 4, 5], [4, 5, 8]]))).toEqual([4, 5]);
    expect(Array.from(intersectAll([]))).toEqual([]);
    expect(Array.from(unionSorted([[5, 9], [1, 5], [7]]))).toEqual([1, 5, 7, 9]);
  });

  it('calcula o fragmento igual ao Python (fnv1a UTF-16 dos 2 primeiros caracteres)', () => {
    // Valores conferidos com shard_of() de scripts/build_data.py.
    expect(fnv1a('gr')).toBe(1293977756);
    expect(shardOf('graca', 256)).toBe(156);
    expect(shardOf('deus', 512)).toBe(162);
    expect(shardOf('γυμναζω', 256)).toBe(5);
    expect(shardOf('שלום', 512)).toBe(328);
    expect(shardOf('𝔸bc', 256)).toBe(174);
  });

  it('encontra o termo no fragmento real publicado em public/data/v1', () => {
    let shard: Record<string, number[]>;
    try {
      shard = JSON.parse(readFileSync(new URL(`../../public/data/v1/search/general/p/${shardOf('γυμναζω', 256)}.json`, import.meta.url), 'utf8'));
    } catch {
      return; // acervo ainda não gerado neste ambiente
    }
    expect(shard['γυμναζω']).toBeDefined();
  });
});

describe('TokenIndex (Bíblia e módulos importados)', () => {
  const builder = new TokenIndexBuilder();
  for (const text of ['No princípio criou Deus os céus', 'E a terra era sem forma', 'Deus disse haja luz', 'E viu Deus que a luz era boa']) builder.add(text);
  const index = builder.finish();

  it('aplica AND entre termos e prefixo no último', () => {
    expect(index.search(parseQuery('deus luz'))).toEqual([2, 3]);
    expect(index.search(parseQuery('deus princ'))).toEqual([0]);
    expect(index.search(parseQuery('era'))).toEqual([1, 3]);
    expect(index.search(parseQuery('ceus'))).toEqual([0]);
    expect(index.search(parseQuery('deus'), 2)).toEqual([0, 2]);
    expect(index.search(parseQuery('inexistente'))).toEqual([]);
  });

  it('sugere como suggestion() do original', () => {
    expect(index.suggest('terrs')).toBe('terra');
    expect(index.suggest('terra')).toBeNull(); // palavra existente
    expect(index.suggest('princ')).toBeNull(); // início de palavra existente (prefixo)
    expect(index.suggest('ter')).toBeNull(); // menos de 4 letras
    expect(index.suggest('terra boa')).toBeNull(); // mais de uma palavra
    expect(index.suggest('xyzw')).toBeNull(); // sem candidatos com as mesmas 2 letras
    expect(index.suggest('tqzzz')).toBeNull(); // distância maior que 2
  });
});

// ---------------------------------------------------- índices invertidos
describe('createSearchService — índices invertidos', () => {
  const files = buildIndex(records, texts, SHARDS, CHUNK);

  it('ordena títulos primeiro, depois a ordem do acervo, em cada grupo', async () => {
    const service = createSearchService(loaders(files));
    const { sections } = await run(service, request('graça', [spec(['A', 'B'])]));
    const general = sections[0] as RecordSection;
    // t2 (só no corpo) vem antes de t3 no acervo, mas t3 tem "Graça" no título.
    expect(ids(general, 'topic')).toEqual(['t3', 't2']);
    expect(ids(general, 'documents')).toEqual(['WCF.1', 'CTX.1']);
    expect(ids(general, 'studies')).toEqual(['s1']);
    expect(ids(general, 'lexicon')).toEqual(['G5485', 'H2580']);
    expect(general.partial).toBe(false);
    expect(general.offline).toBe(false);
  });

  it('intersecta todos os termos (AND)', async () => {
    const service = createSearchService(loaders(files));
    const { sections } = await run(service, request('graça deus', [spec(['A', 'B'])]));
    const general = sections[0] as RecordSection;
    // Nenhum título tem os dois termos: fica a ordem do acervo.
    expect(ids(general, 'topic')).toEqual(['t2', 't3']);
    expect(ids(general, 'studies')).toEqual(['s1']);
    expect(general.groups.documents).toBeUndefined();
    expect(general.groups.lexicon).toBeUndefined();
  });

  it('títulos fora da janela de candidatos também sobem ao topo (blocos já carregados)', async () => {
    const many: [SearchRecord, string][] = Array.from({ length: 120 }, (_, i) => [['topic', `t${i}`, `Tema ${i}`, 'paz', 'T', ''], 'paz']);
    many.push([['topic', 'last', 'Paz de Cristo', 'paz', 'T', ''], 'Paz de Cristo paz']);
    const files2 = buildIndex(
      many.map(([r]) => r),
      many.map(([, t]) => t),
      SHARDS,
      1000,
    );
    const topicSpec: IndexSpec = { ...spec([]), records: many.length, chunk: 1000, segments: [{ start: 0, end: many.length, group: 'topic', allowed: true }], limits: { topic: LIMITS.topic } };
    const { sections } = await run(createSearchService(loaders(files2)), request('paz', [topicSpec]));
    const topics = ids(sections[0], 'topic');
    expect(topics[0]).toBe('last');
    expect(topics.length).toBe(LIMITS.topic);
  });

  it('casa o último termo por prefixo dentro do fragmento', async () => {
    const service = createSearchService(loaders(files));
    const { sections } = await run(service, request('jerus', [spec(['A', 'B'])]));
    expect(ids(sections[0], 'documents')).toEqual(['CTX.1']);
    const none = await run(service, request('je', [spec(['A', 'B'])]));
    expect(ids(none.sections[0], 'documents')).toEqual([]);
  });

  it('descarta documentos de módulos desinstalados sem baixar seus blocos', async () => {
    const log: string[] = [];
    const service = createSearchService(loaders(files, { log }));
    const { sections } = await run(service, request('graça', [spec(['A'])]));
    expect(ids(sections[0], 'documents')).toEqual(['WCF.1']);
    // O registro 5 (módulo B) fica no bloco 2, que nem chega a ser pedido.
    expect(log.some((u) => u.includes('r/2.json'))).toBe(false);
  });

  it('refaz sem a disposição do catálogo quando ela não confere', async () => {
    const wrong: Segment[] = [
      { start: 0, end: 5, group: 'topic', allowed: true },
      { start: 5, end: 9, group: 'lexicon', allowed: true },
    ];
    const service = createSearchService(loaders(files));
    const { sections } = await run(service, request('graça', [spec(['A', 'B'], { segments: wrong })]));
    const general = sections[0] as RecordSection;
    expect(ids(general, 'topic')).toEqual(['t3', 't2']);
    expect(ids(general, 'documents')).toEqual(['WCF.1', 'CTX.1']);
    expect(ids(general, 'lexicon')).toEqual(['G5485', 'H2580']);
  });

  it('sem conexão, devolve o que está salvo e marca a seção', async () => {
    const offline = new Set([`${BASE}r/1.json?v=${VERSION}`]);
    const service = createSearchService(loaders(files, { offline }));
    const { sections } = await run(service, request('graça', [spec(['A', 'B'])]));
    const general = sections[0] as RecordSection;
    expect(general.offline).toBe(true);
    expect(general.error).toBeUndefined();
    // t3 e WCF.1 (bloco 1) ficaram de fora; o restante aparece.
    expect(ids(general, 'topic')).toEqual(['t2']);
    expect(ids(general, 'documents')).toEqual(['CTX.1']);
    expect(ids(general, 'lexicon')).toEqual(['G5485', 'H2580']);
  });

  it('fragmento indisponível offline vira erro "offline" da seção, sem derrubar as outras', async () => {
    const offline = new Set([`${BASE}p/${shardOf('graca', SHARDS)}.json?v=${VERSION}`]);
    const service = createSearchService(loaders(files, { offline }));
    const other: IndexSpec = { ...spec([]), name: 'commentary', base: 'https://exemplo.test/vazio/', segments: null, limits: { commentary: 60 } };
    const { sections } = await run(service, request('graça', [spec(['A', 'B']), other]));
    const general = sections.find((s) => s.name === 'general') as RecordSection;
    expect(general.error?.kind).toBe('offline');
    expect(general.offline).toBe(true);
    expect(sections.find((s) => s.name === 'commentary')).toBeDefined();
  });

  it('limita os blocos baixados da rede por pesquisa (economia de dados) e libera em "deep"', async () => {
    const many: [SearchRecord, string][] = Array.from({ length: 40 }, (_, i) => [['lexicon', `L${i}`, `L${i}`, 'luz', 'S', ''], 'luz']);
    const files2 = buildIndex(
      many.map(([r]) => r),
      many.map(([, t]) => t),
      SHARDS,
      2,
    );
    const lexSpec: IndexSpec = {
      ...spec([]),
      records: 40,
      chunk: 2,
      segments: [{ start: 0, end: 40, group: 'lexicon', allowed: true }],
      limits: { lexicon: LIMITS.lexicon },
    };
    const log: string[] = [];
    const service = createSearchService(loaders(files2, { log }));
    const { sections } = await run(service, request('luz', [lexSpec]));
    const section = sections[0] as RecordSection;
    expect(section.partial).toBe(true);
    expect(log.filter((u) => u.includes('/r/')).length).toBe(NETWORK_BUDGET);
    expect(ids(section, 'lexicon').length).toBe(NETWORK_BUDGET * 2);

    const deep = await run(createSearchService(loaders(files2)), request('luz', [lexSpec], { deep: true }));
    expect((deep.sections[0] as RecordSection).partial).toBe(false);
    expect(ids(deep.sections[0], 'lexicon').length).toBe(LIMITS.lexicon);
  });

  it('blocos já salvos no aparelho não contam para o limite de dados', async () => {
    const many: [SearchRecord, string][] = Array.from({ length: 30 }, (_, i) => [['lexicon', `L${i}`, `L${i}`, 'luz', 'S', ''], 'luz']);
    const files2 = buildIndex(
      many.map(([r]) => r),
      many.map(([, t]) => t),
      SHARDS,
      2,
    );
    const cached = new Set([...files2.keys()].filter((u) => u.includes('/r/')));
    const lexSpec: IndexSpec = { ...spec([]), records: 30, chunk: 2, segments: [{ start: 0, end: 30, group: 'lexicon', allowed: true }], limits: { lexicon: 40 } };
    const { sections } = await run(createSearchService(loaders(files2, { cached })), request('luz', [lexSpec]));
    expect((sections[0] as RecordSection).partial).toBe(false);
    expect(ids(sections[0], 'lexicon').length).toBe(30);
  });

  it('respeita o cancelamento (consulta antiga não entrega seções)', async () => {
    const service = createSearchService(loaders(files));
    const sections: SectionResult[] = [];
    await service.run(request('graça', [spec(['A', 'B'])]), { cancelled: () => true, section: (s) => sections.push(s) });
    expect(sections).toEqual([]);
  });
});

// ----------------------------------------------------------------- Bíblia
describe('createSearchService — Bíblia no worker', () => {
  const book = (b: number, chapters: string[][]) => ({ b, c: chapters.map((verses) => verses.map((text, i) => [i + 1, text])) });
  const books = new Map<string, unknown>([
    ['https://exemplo.test/bible/1.json', book(1, [['No princípio criou Deus os céus e a terra.', 'A terra era sem forma e vazia.'], ['Assim os céus e a terra foram acabados.']])],
    ['https://exemplo.test/bible/43.json', book(43, [['No princípio era o Verbo, e o Verbo estava com Deus.'], [], ['Porque Deus amou o mundo de tal maneira.']])],
  ]);
  const source = {
    kind: 'urls' as const,
    key: 'X:1',
    translation: 'X',
    books: [1, 43],
    urls: ['https://exemplo.test/bible/1.json', 'https://exemplo.test/bible/43.json'],
  };

  it('monta o índice uma vez, informa o progresso e responde em ordem canônica', async () => {
    const log: string[] = [];
    const service = createSearchService(loaders(books, { log }));
    const { sections, progress } = await run(service, request('deus', [], { bible: source }));
    const bible = sections[0] as BibleSection;
    expect(bible.hits.map(([key]) => key)).toEqual([1001001, 43001001, 43003001]);
    expect(bible.hits[2][1]).toBe('Porque Deus amou o mundo de tal maneira.');
    expect(progress[0]).toEqual([0, 2]);
    expect(progress[progress.length - 1]).toEqual([2, 2]);
    await run(service, request('terra', [], { bible: source }));
    expect(log.length).toBe(2); // segunda consulta reaproveita o índice
  });

  it('aplica AND, prefixo e a sugestão de grafia', async () => {
    const service = createSearchService(loaders(books));
    const both = (await run(service, request('ceus terr', [], { bible: source }))).sections[0] as BibleSection;
    expect(both.hits.map(([key]) => key)).toEqual([1001001, 1002001]);
    const typo = (await run(service, request('pricipio', [], { bible: source }))).sections[0] as BibleSection;
    expect(typo.hits).toEqual([]);
    expect(typo.suggestion).toBe('principio');
  });

  it('limita a 60 versículos', async () => {
    const big = new Map<string, unknown>([['https://exemplo.test/bible/19.json', book(19, [Array.from({ length: 100 }, () => 'Louvai ao Senhor')])]]);
    const service = createSearchService(loaders(big));
    const src = { kind: 'urls' as const, key: 'Y:1', translation: 'Y', books: [19], urls: ['https://exemplo.test/bible/19.json'] };
    const bible = (await run(service, request('senhor', [], { bible: src }))).sections[0] as BibleSection;
    expect(bible.hits.length).toBe(LIMITS.bible);
    expect(bible.hits[59][0]).toBe(19001060);
  });

  it('sem conexão, pesquisa nos livros salvos e conta os que faltaram', async () => {
    const service = createSearchService(loaders(books, { offline: new Set(['https://exemplo.test/bible/43.json']) }));
    const bible = (await run(service, request('deus', [], { bible: source }))).sections[0] as BibleSection;
    expect(bible.hits.map(([key]) => key)).toEqual([1001001]);
    expect(bible.missing).toBe(1);
    expect(bible.total).toBe(2);
    expect(bible.offline).toBe(true);
  });

  it('lê Bíblias importadas do IndexedDB (user_module_data b:<livro>)', async () => {
    const service = createSearchService({
      json: async () => {
        throw new Error('não deveria baixar');
      },
      userData: async (module, key) => (module === 'MINHA' && key === 'b:1' ? books.get('https://exemplo.test/bible/1.json') : null),
    });
    const src = { kind: 'user' as const, key: 'user:MINHA:1', translation: 'MINHA', module: 'MINHA', books: [1] };
    const bible = (await run(service, request('vazia', [], { bible: src }))).sections[0] as BibleSection;
    expect(bible.hits.map(([key]) => key)).toEqual([1001002]);
  });
});

describe('createSearchService — módulos importados', () => {
  it('indexa documentos e comentários do IndexedDB', async () => {
    const data: Record<string, unknown> = {
      'DEV|docs': [
        ['DEV:1', 'devotional', 'Manhã', 'Graça para hoje', '43:3:16', {}],
        ['DEV:2', 'devotional', 'Graça abundante', 'Leitura da noite', '', {}],
      ],
      'COM|c:43': [['COM:1', 43003016, 43003016, 'João 3:16', 'O amor de Deus e a graça', 'exegesis', 0]],
    };
    const service = createSearchService({ json: async () => ({}), userData: async (m, k) => data[`${m}|${k}`] ?? null });
    const { sections } = await run(
      service,
      request('graça', [], {
        user: [
          { id: 'DEV', kind: 'docs', stamp: '1', books: [] },
          { id: 'COM', kind: 'commentary', stamp: '1', books: [43] },
        ],
      }),
    );
    const user = sections[0] as RecordSection;
    expect(ids(user, 'documents')).toEqual(['DEV:2', 'DEV:1']); // título primeiro
    expect(user.groups.commentary?.[0].r).toEqual(['commentary', 'COM:1', 'João 3:16', 'O amor de Deus e a graça', 'COM', '43:3:16']);
  });
});

// ------------------------------------------------------------- resultado
describe('montagem do resultado', () => {
  const hit = (category: string, id: string, titleMatch = false): SearchHit => ({
    key: `${category}:${id}`,
    category,
    id,
    title: id,
    body: '',
    source: '',
    reference: '',
    titleMatch,
  });

  it('segue a ordem do original e remove repetições categoria:id', () => {
    const merged = mergeHits({
      lexicon: [hit('lexicon', 'G1')],
      topic: [hit('topic', 't1')],
      bible: [hit('bible', '43:3:16')],
      documents: [hit('confession', 'WCF.1'), hit('confession', 'WCF.1')],
      notes: [hit('notes', 'n1')],
      commentary: [hit('commentary', 'c1')],
      studies: [hit('studies', 's1')],
    });
    expect(merged.map((h) => h.key)).toEqual(['topic:t1', 'bible:43:3:16', 'notes:n1', 'confession:WCF.1', 'studies:s1', 'commentary:c1', 'lexicon:G1']);
  });

  it('junta acervo e módulos importados com títulos primeiro e limite', () => {
    const out = combine([[hit('commentary', 'a'), hit('commentary', 'b', true)], [hit('commentary', 'c', true)]], 2);
    expect(out.map((h) => h.id)).toEqual(['b', 'c']);
    expect(titleFirst([{ t: false, n: 1 }, { t: true, n: 2 }]).map((x) => x.n)).toEqual([2, 1]);
  });

  it('converte registros e agrupa categorias de documentos', () => {
    const h = recordHit({ r: ['confession', 'WCF.1', 'Da Escritura', 'Salmos 19:1(biblia:19:19:1)', 'WCF', '19:19:1'], t: true });
    expect(h).toMatchObject({ key: 'confession:WCF.1', body: 'Salmos 19:1', source: 'WCF', reference: '19:19:1', titleMatch: true });
    expect(groupOf('model_index')).toBe('documents');
    expect(groupOf('topic')).toBe('topic');
  });
});
