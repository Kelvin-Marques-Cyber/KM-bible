// Cola do Web Worker (workers/search.worker.ts): mensagens de pesquisa,
// progresso, seções, cancelamento e leitura de Bíblias importadas do IndexedDB.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { put } from '../../src/lib/db';
import { parseQuery, type SearchRequest, type SearchWorkerMessage, type SearchWorkerRequest } from '../../src/lib/search-core';

const posted: SearchWorkerMessage[] = [];
let handler: (event: { data: SearchWorkerRequest }) => Promise<void>;
const originalPost = self.postMessage;

const book = (b: number, verses: string[]) => ({ b, c: [verses.map((text, i) => [i + 1, text])] });
const files: Record<string, unknown> = {
  'https://exemplo.test/b/1.json': book(1, ['No princípio criou Deus os céus e a terra.', 'A terra era sem forma e vazia.']),
  'https://exemplo.test/b/2.json': book(2, ['Estes pois são os nomes dos filhos de Israel.']),
};

beforeAll(async () => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const body = files[String(input)];
    return body === undefined ? new Response('', { status: 404 }) : new Response(JSON.stringify(body), { status: 200 });
  });
  (self as unknown as { postMessage: (m: SearchWorkerMessage) => void }).postMessage = (m) => posted.push(m);
  await import('../../src/workers/search.worker');
  handler = (self as unknown as { onmessage: typeof handler }).onmessage;
});

afterAll(() => {
  (self as unknown as { postMessage: typeof originalPost }).postMessage = originalPost;
  vi.unstubAllGlobals();
});

const request = (text: string, bible: SearchRequest['bible']): SearchRequest => ({ text, query: parseQuery(text), bible, indexes: [], user: [], deep: false });
const source = { kind: 'urls' as const, key: 'W:1', translation: 'W', books: [1, 2], urls: ['https://exemplo.test/b/1.json', 'https://exemplo.test/b/2.json'] };

describe('search.worker', () => {
  it('responde com progresso, seção bíblica e "done"', async () => {
    posted.length = 0;
    await handler({ data: { id: 1, type: 'search', request: request('terra', source) } });
    const types = posted.filter((m) => m.id === 1).map((m) => m.type);
    expect(types).toContain('progress');
    expect(types[types.length - 1]).toBe('done');
    const section = posted.find((m) => m.type === 'section');
    expect(section?.type === 'section' && section.section.name === 'bible' && section.section.hits.map(([k]) => k)).toEqual([1001001, 1001002]);
  });

  it('cancelamento silencia a consulta antiga', async () => {
    posted.length = 0;
    const running = handler({ data: { id: 2, type: 'search', request: request('israel', source) } });
    await handler({ data: { id: 2, type: 'cancel' } });
    await running;
    expect(posted.filter((m) => m.id === 2)).toEqual([]);
  });

  it('lê Bíblias importadas direto do IndexedDB (somente leitura)', async () => {
    await put('user_module_data', { module: 'MINHA', key: 'b:1', value: book(1, ['Graça e paz a vós.']) });
    posted.length = 0;
    const user = { kind: 'user' as const, key: 'user:MINHA:1', translation: 'MINHA', module: 'MINHA', books: [1] };
    await handler({ data: { id: 3, type: 'search', request: request('graça', user) } });
    const section = posted.find((m) => m.id === 3 && m.type === 'section');
    expect(section?.type === 'section' && section.section.name === 'bible' && section.section.hits).toEqual([[1001001, 'Graça e paz a vós.']]);
  });
});
