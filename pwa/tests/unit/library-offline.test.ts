// Gerenciador offline (src/lib/offline.ts): grupos, URLs, status, download com
// concorrência/retentativas/cancelamento, remoção e "Baixar tudo", com uma
// Cache API em memória.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog, dataBase } from '../../src/lib/catalog';
import {
  DATA_CACHE,
  DOWNLOAD_HEADER,
  FULL_FLAG,
  OfflineQuotaError,
  cancelOfflineJob,
  downloadAll,
  downloadItems,
  essentialGroups,
  filesIndexUrl,
  fullOfflineFlag,
  fullSize,
  groupItems,
  groupStatuses,
  isComplete,
  isFullyOffline,
  itemsFor,
  loadFilesIndex,
  offlineGroups,
  offlineJob,
  removeGroup,
  resetOfflineState,
  runOfflineJob,
  subscribeOfflineJob,
  type DownloadItem,
  type FilesIndex,
} from '../../src/lib/offline';

class MemoryCache {
  entries = new Map<string, Response>();
  puts = 0;
  failPut: ((url: string) => unknown) | null = null;
  private key(input: RequestInfo | URL) {
    return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).href;
  }
  async match(input: RequestInfo | URL) {
    const hit = this.entries.get(this.key(input));
    return hit ? hit.clone() : undefined;
  }
  async put(input: RequestInfo | URL, response: Response) {
    const failure = this.failPut?.(this.key(input));
    if (failure) throw failure;
    // Consome o corpo como o navegador faz ao gravar no disco.
    const body = await response.arrayBuffer();
    this.puts++;
    this.entries.set(this.key(input), new Response(body, { status: response.status, headers: response.headers }));
  }
  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
  async delete(input: RequestInfo | URL) {
    return this.entries.delete(this.key(input));
  }
}

let cache: MemoryCache;
const base = () => dataBase();

/** files.json mínimo: os pacotes reais do catálogo com dois arquivos cada. */
function fakeIndex(): FilesIndex {
  const index: FilesIndex = {};
  const add = (p: { path: string; hash: string } | null) => {
    if (p) index[p.path] = { hash: p.hash, files: ['a.json', 'b/c.json'] };
  };
  Object.values(catalog.bibles).forEach(add);
  Object.values(catalog.commentaries).forEach(add);
  [catalog.xref, catalog.words, catalog.lexicon, catalog.topics, catalog.docs, catalog.misc, catalog.licenses, catalog.apologetica, catalog.agostinho, catalog.search.general, catalog.search.commentary].forEach(add);
  index[catalog.models3d.path] = { hash: catalog.models3d.hash, files: ['arca_noe.glb', 'viewer.html'] };
  return index;
}

const ok = (body = '{}') => new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });

function installFetch(index: FilesIndex, handler?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    if (url.startsWith(filesIndexUrl())) return ok(JSON.stringify(index));
    return handler ? handler(url, init) : ok();
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

beforeEach(() => {
  resetOfflineState();
  cache = new MemoryCache();
  vi.stubGlobal('caches', { open: async (name: string) => (name === DATA_CACHE ? cache : new MemoryCache()) });
  try {
    localStorage.removeItem(FULL_FLAG);
  } catch {
    /* sem localStorage */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URLs e grupos', () => {
  it('files.json fica na raiz de data/v1 (sem barra dupla)', () => {
    const url = filesIndexUrl();
    expect(url).toBe(`${base()}files.json?v=${catalog.filesIndex.hash}`);
    expect(url).not.toContain('v1//');
  });

  it('cada tradução e comentário instalados viram grupos, além dos grupos fixos', () => {
    const groups = offlineGroups();
    const ids = groups.map((g) => g.id);
    for (const id of Object.keys(catalog.bibles)) {
      const m = catalog.modules.find((x) => x.id === id);
      expect(ids.includes(`bible:${id}`)).toBe(!!m?.installed);
    }
    for (const id of Object.keys(catalog.commentaries)) expect(ids).toContain(`comm:${id}`);
    expect(ids).toEqual(expect.arrayContaining(['xref', 'original', 'topics', 'documents', 'search', 'models']));
    expect(ids).not.toContain('bible:ARC');

    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId.original.packs.map((p) => p.path)).toEqual([catalog.words.path, catalog.lexicon.path]);
    expect(byId.search.packs.map((p) => p.path)).toEqual([catalog.search.general.path, catalog.search.commentary.path]);
    const docs = byId.documents.packs.map((p) => p.path);
    expect(docs).toEqual(expect.arrayContaining([catalog.docs.path, catalog.misc.path, catalog.licenses.path]));
    if (catalog.apologetica) expect(docs).toContain(catalog.apologetica.path);
    if (catalog.agostinho) expect(docs).toContain(catalog.agostinho.path);
    expect(byId.models.packs[0].path).toBe(catalog.models3d.path);
    expect(byId['bible:BLN4'].bytes).toBe(catalog.bibles.BLN4.bytes);
    expect(byId.original.bytes).toBe(catalog.words.bytes + catalog.lexicon.bytes);
  });

  it('fullSize soma os bytes do catálogo de todos os grupos', () => {
    const groups = offlineGroups();
    expect(fullSize(groups)).toBe(groups.reduce((sum, g) => sum + g.bytes, 0));
    expect(fullSize()).toBeGreaterThan(catalog.models3d.bytes + catalog.xref.bytes);
  });

  it('essencial: tradução atual, referências cruzadas, temas, documentos e pesquisa', () => {
    const ids = essentialGroups('BLN4').map((g) => g.id).sort();
    expect(ids).toEqual(['bible:BLN4', 'documents', 'search', 'topics', 'xref']);
    expect(essentialGroups('NAO-EXISTE').map((g) => g.id)).not.toContain('bible:NAO-EXISTE');
  });

  it('URLs dos arquivos iguais às de content.ts (packUrl com o hash do pacote)', () => {
    const index = fakeIndex();
    const bln = offlineGroups().find((g) => g.id === 'bible:BLN4')!;
    const items = groupItems(bln, index);
    expect(items.map((i) => i.url)).toEqual([
      `${base()}bible/BLN4/a.json?v=${catalog.bibles.BLN4.hash}`,
      `${base()}bible/BLN4/b/c.json?v=${catalog.bibles.BLN4.hash}`,
    ]);
    expect(items[0].bytes).toBe(Math.round(catalog.bibles.BLN4.bytes / 2));
    // Modelos 3D: tamanho individual do catálogo; o restante dividido entre os demais.
    const models = groupItems(offlineGroups().find((g) => g.id === 'models')!, index);
    expect(models[0]).toEqual({ url: `${base()}3d/arca_noe.glb?v=${catalog.models3d.hash}`, bytes: catalog.models3d.sizes['arca_noe.glb'] });
    // Pacote ausente do índice: nenhuma URL.
    expect(groupItems(bln, {})).toEqual([]);
    // itemsFor inclui files.json e não repete URLs.
    const all = itemsFor([bln, bln], index);
    expect(all[0].url).toBe(filesIndexUrl());
    expect(all).toHaveLength(3);
  });
});

describe('índice files.json', () => {
  it('busca na rede, grava no cache e depois lê do cache', async () => {
    const index = fakeIndex();
    const { calls } = installFetch(index);
    expect(await loadFilesIndex()).toEqual(index);
    expect(await cache.match(filesIndexUrl())).toBeTruthy();
    resetOfflineState();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('offline');
    }));
    expect(await loadFilesIndex()).toEqual(index);
    expect(calls).toHaveLength(1);
  });

  it('sem rede e sem cache: erro claro, e nova tentativa possível', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('offline');
    }));
    await expect(loadFilesIndex()).rejects.toMatchObject({ name: 'OfflineIndexError' });
    installFetch(fakeIndex());
    await expect(loadFilesIndex()).resolves.toBeTruthy();
  });
});

describe('download', () => {
  const items = (n: number, size = 1000): DownloadItem[] => Array.from({ length: n }, (_, i) => ({ url: `${base()}xref/${i}.json?v=h`, bytes: size }));

  it('pula o que já está no cache e baixa o resto (retomada)', async () => {
    const list = items(6);
    await cache.put(list[0].url, ok());
    await cache.put(list[1].url, ok());
    const seen: string[] = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String(url));
      expect(new Headers(init?.headers).get(DOWNLOAD_HEADER)).toBe('1');
      return ok();
    });
    const progress: number[] = [];
    const result = await downloadItems(list, { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, onProgress: (p) => progress.push(p.done), persist: false });
    expect(result).toMatchObject({ total: 6, done: 6, skipped: 2, failed: 0, cancelled: false, bytesTotal: 6000, bytesDone: 6000 });
    expect(seen).toHaveLength(4);
    expect(progress[0]).toBe(2);
    expect(progress[progress.length - 1]).toBe(6);
    expect(cache.entries.size).toBe(6);
  });

  it('respeita a concorrência', async () => {
    let active = 0;
    let peak = 0;
    const fetcher = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return ok();
    });
    await downloadItems(items(20), { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, concurrency: 3, persist: false });
    expect(peak).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(20);
  });

  it('tenta de novo em falhas temporárias e desiste em 404', async () => {
    const list = items(3);
    let flaky = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u === list[0].url && flaky++ < 2) return new Response('', { status: 503 });
      if (u === list[1].url) return new Response('', { status: 404 });
      if (u === list[2].url && flaky < 99) throw new TypeError('rede caiu');
      return ok();
    });
    const result = await downloadItems(list, { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, retries: 2, retryDelay: 1, persist: false });
    expect(result.done).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.failures.sort()).toEqual([list[1].url, list[2].url].sort());
    // 404: uma única tentativa; erro de rede: 1 + 2 novas tentativas.
    expect(fetcher.mock.calls.filter(([u]) => String(u) === list[1].url)).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([u]) => String(u) === list[2].url)).toHaveLength(3);
    expect(await cache.match(list[0].url)).toBeTruthy();
  });

  it('resposta "offline" do service worker não é gravada', async () => {
    const fetcher = vi.fn(async () => new Response('{"offline":true}', { status: 200, headers: { 'X-KM-Offline': '1' } }));
    const result = await downloadItems(items(1), { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, retries: 0, persist: false });
    expect(result.failed).toBe(1);
    expect(cache.entries.size).toBe(0);
  });

  it('cancela no meio sem marcar falhas', async () => {
    const controller = new AbortController();
    let count = 0;
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (++count === 3) controller.abort();
      if (init?.signal?.aborted) throw new DOMException('cancelado', 'AbortError');
      return ok();
    });
    const result = await downloadItems(items(10), { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, concurrency: 1, signal: controller.signal, persist: false });
    expect(result.cancelled).toBe(true);
    expect(result.failed).toBe(0);
    expect(result.done).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('recusa começar sem espaço suficiente', async () => {
    const fetcher = vi.fn(async () => ok());
    await expect(
      downloadItems(items(10, 1_000_000), { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, room: { usage: 0, quota: 5_000_000, available: 5_000_000 }, persist: false }),
    ).rejects.toBeInstanceOf(OfflineQuotaError);
    expect(fetcher).not.toHaveBeenCalled();
    // Cota desconhecida: segue normalmente.
    await expect(
      downloadItems(items(2), { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, room: { usage: null, quota: null, available: null }, persist: false }),
    ).resolves.toMatchObject({ done: 2 });
  });

  it('cota esgotada durante a gravação interrompe tudo com mensagem clara', async () => {
    cache.failPut = (url) => (url.endsWith('/3.json?v=h') ? new DOMException('cheio', 'QuotaExceededError') : null);
    const fetcher = vi.fn(async () => ok());
    await expect(downloadItems(items(8), { cache: cache as unknown as Cache, fetcher: fetcher as typeof fetch, concurrency: 1, persist: false })).rejects.toBeInstanceOf(OfflineQuotaError);
    expect(fetcher.mock.calls.length).toBeLessThan(8);
  });
});

describe('status, Baixar tudo e remoção', () => {
  it('downloadAll baixa todos os grupos, marca km-offline-full e isFullyOffline confirma', async () => {
    const index = fakeIndex();
    installFetch(index);
    const groups = offlineGroups();
    let before = await groupStatuses(groups, index, cache as unknown as Cache);
    expect(Object.values(before).every((s) => s.present === 0)).toBe(true);
    expect(await isFullyOffline(cache as unknown as Cache)).toBe(false);

    const result = await downloadAll(undefined, undefined, { cache: cache as unknown as Cache, persist: false, room: { usage: null, quota: null, available: null } });
    expect(result.failed).toBe(0);
    expect(result.total).toBe(itemsFor(groups, index).length);
    expect(fullOfflineFlag()).toBe(true);
    expect(localStorage.getItem(FULL_FLAG)).toBe('1');
    expect(await isFullyOffline(cache as unknown as Cache)).toBe(true);
    before = await groupStatuses(groups, index, cache as unknown as Cache);
    expect(groups.every((g) => isComplete(before[g.id]))).toBe(true);

    // Remover um grupo apaga só os arquivos dele (inclusive versões antigas) e desmarca o indicador.
    const xref = groups.find((g) => g.id === 'xref')!;
    await cache.put(`${base()}xref/a.json?v=velho`, ok());
    await cache.put(`${base()}search/comm/a.json?v=x`, ok());
    const removed = await removeGroup(xref, cache as unknown as Cache);
    expect(removed).toBe(3);
    expect(await cache.match(`${base()}search/comm/a.json?v=x`)).toBeTruthy();
    expect(fullOfflineFlag()).toBe(false);
    const after = await groupStatuses(groups, index, cache as unknown as Cache);
    expect(after.xref).toMatchObject({ present: 0, total: 2 });
    expect(isComplete(after['bible:BLN4'])).toBe(true);
    expect(await isFullyOffline(cache as unknown as Cache)).toBe(false);
  });

  it('com falhas, downloadAll não marca o indicador', async () => {
    const index = fakeIndex();
    installFetch(index, (url) => (url.includes('/xref/') ? new Response('', { status: 404 }) : ok()));
    const result = await downloadAll(undefined, undefined, { cache: cache as unknown as Cache, persist: false, retries: 0, room: { usage: null, quota: null, available: null } });
    expect(result.failed).toBe(2);
    expect(fullOfflineFlag()).toBe(false);
  });
});

describe('tarefa offline', () => {
  it('uma tarefa por vez, com cancelamento e notificação', async () => {
    const states: string[] = [];
    const stop = subscribeOfflineJob(() => states.push(offlineJob()?.state ?? 'none'));
    let release!: () => void;
    const first = runOfflineJob('all', 'Tudo', (onProgress, signal) => {
      onProgress({ total: 2, done: 1, skipped: 0, failed: 0, bytesTotal: 2, bytesDone: 1 });
      return new Promise((resolve) => {
        release = () => resolve({ total: 2, done: 1, skipped: 0, failed: 0, bytesTotal: 2, bytesDone: 1, cancelled: signal.aborted, failures: [] });
        signal.addEventListener('abort', release);
      });
    });
    expect(offlineJob()?.state).toBe('running');
    expect(await runOfflineJob('xref', 'Outro', async () => ({ total: 0, done: 0, skipped: 0, failed: 0, bytesTotal: 0, bytesDone: 0, cancelled: false, failures: [] }))).toBeNull();
    cancelOfflineJob();
    await first;
    expect(offlineJob()?.state).toBe('cancelled');
    expect(states).toContain('running');
    expect(states[states.length - 1]).toBe('cancelled');

    const failed = await runOfflineJob('x', 'Falha', async () => {
      throw new OfflineQuotaError(10, 1);
    });
    expect(failed).toBeNull();
    expect(offlineJob()?.state).toBe('error');
    expect(offlineJob()?.error).toBeInstanceOf(OfflineQuotaError);
    stop();
  });

  it('limita as atualizações da interface, mas a última sempre chega', async () => {
    const p = (done: number) => ({ total: 10, done, skipped: 0, failed: 0, bytesTotal: 10, bytesDone: done });
    let finish!: () => void;
    const running = runOfflineJob('all', 'Tudo', (onProgress) => {
      onProgress(p(1));
      onProgress(p(2));
      onProgress(p(3));
      return new Promise((resolve) => {
        finish = () => resolve({ ...p(10), cancelled: false, failures: [] });
      });
    });
    // A primeira chega na hora; as seguintes, agrupadas em até 100 ms.
    expect(offlineJob()?.progress?.done).toBe(1);
    await new Promise((r) => setTimeout(r, 160));
    expect(offlineJob()?.progress?.done).toBe(3);
    finish();
    await running;
    expect(offlineJob()).toMatchObject({ state: 'done', progress: { done: 10 } });
  });
});
