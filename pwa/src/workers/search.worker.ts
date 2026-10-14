// Web Worker da pesquisa geral (SearchPage de lib/search.dart): mantém o índice
// da tradução atual em memória (todos os livros, uma única vez), consulta os
// índices invertidos do acervo (pesquisa geral e comentários) e os módulos
// importados (IndexedDB), sem ocupar a thread da interface.
import {
  createSearchService,
  errorInfo,
  SearchLoadError,
  type SearchWorkerMessage,
  type SearchWorkerRequest,
} from '../lib/search-core';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: SearchWorkerMessage) => scope.postMessage(message);

async function json(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new SearchLoadError('offline', url);
  }
  if (response.status === 404) throw new SearchLoadError('missing', url);
  // O service worker responde 503 (X-KM-Offline) quando o arquivo não está salvo.
  if (response.status === 503 || response.status === 504) throw new SearchLoadError('offline', url);
  if (!response.ok) throw new SearchLoadError('http', url, `HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new SearchLoadError('http', url, 'JSON inválido');
  }
}

async function isCached(url: string): Promise<boolean> {
  try {
    return typeof caches !== 'undefined' && (await caches.match(url)) !== undefined;
  } catch {
    return false;
  }
}

// IndexedDB somente leitura: o banco é criado e migrado pela thread principal (lib/db.ts).
let opening: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open('km-bible');
    } catch (error) {
      reject(error);
      return;
    }
    // Nunca cria nem altera o banco aqui.
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponível'));
    request.onblocked = () => reject(new Error('IndexedDB bloqueado'));
  });
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

async function userData(module: string, key: string): Promise<unknown> {
  const db = await openDb();
  if (!db.objectStoreNames.contains('user_module_data')) return null;
  return new Promise((resolve, reject) => {
    const request = db.transaction('user_module_data', 'readonly').objectStore('user_module_data').get([module, key]);
    request.onsuccess = () => resolve((request.result as { value?: unknown } | undefined)?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

// Cede a vez para que mensagens novas (cancelamentos, consultas) sejam lidas.
const channel = new MessageChannel();
const waiting: (() => void)[] = [];
channel.port1.onmessage = () => waiting.shift()?.();
const pause = () =>
  new Promise<void>((resolve) => {
    waiting.push(resolve);
    channel.port2.postMessage(0);
  });

const service = createSearchService({ json, isCached, userData, pause, now: () => performance.now() });
const running = new Set<number>();
const cancelled = new Set<number>();

scope.onmessage = async (event: MessageEvent<SearchWorkerRequest>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    if (running.has(message.id)) cancelled.add(message.id);
    return;
  }
  if (message.type === 'clear') {
    service.clear();
    return;
  }
  const id = message.id;
  const alive = () => !cancelled.has(id);
  running.add(id);
  try {
    if (message.type === 'warm') {
      await service.warm(message.bible, (done, total) => alive() && post({ id, type: 'progress', done, total }));
    } else {
      await service.run(message.request, {
        cancelled: () => !alive(),
        progress: (done, total) => alive() && post({ id, type: 'progress', done, total }),
        section: (section) => alive() && post({ id, type: 'section', section }),
      });
    }
  } catch (error) {
    if (alive()) post({ id, type: 'error', error: errorInfo(error) });
  } finally {
    if (alive()) post({ id, type: 'done' });
    running.delete(id);
    cancelled.delete(id);
  }
};
