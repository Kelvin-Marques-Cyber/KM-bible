// IndexedDB mínimo, sem dependências. Guarda SOMENTE dados pessoais e módulos
// importados pelo usuário; o acervo público vem de arquivos estáticos em cache.

export const DB_NAME = 'km-bible';
export const DB_VERSION = 1;

export type StoreName =
  | 'prefs'
  | 'notes'
  | 'note_links'
  | 'highlights'
  | 'bookmarks'
  | 'study_tabs'
  | 'reading_history'
  | 'attachments'
  | 'flashcards'
  | 'review_history'
  | 'learning_progress'
  | 'user_modules'
  | 'user_module_data'
  | 'meta';

let opening: Promise<IDBDatabase> | null = null;
let fallback: IDBFactory | null = null;
let memoryOnly = false;

/** IndexedDB em memória (fake-indexeddb) quando o navegador bloqueia o armazenamento. */
export function useFallbackFactory(factory: IDBFactory): void {
  fallback = factory;
  memoryOnly = true;
  opening = null;
}
export const isMemoryOnly = () => memoryOnly;

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export function openDb(factory?: IDBFactory): Promise<IDBDatabase> {
  if (opening) return opening;
  factory = factory ?? fallback ?? indexedDB;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory!.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(new StorageUnavailableError(String(error)));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      const make = (name: string, options?: IDBObjectStoreParameters) =>
        db.objectStoreNames.contains(name) ? request.transaction!.objectStore(name) : db.createObjectStore(name, options);
      make('prefs', { keyPath: 'key' });
      const notes = make('notes', { keyPath: 'id' });
      if (!notes.indexNames.contains('reference')) notes.createIndex('reference', 'reference');
      if (!notes.indexNames.contains('updated_at')) notes.createIndex('updated_at', 'updated_at');
      const links = make('note_links', { keyPath: ['source_id', 'target_id'] });
      if (!links.indexNames.contains('target_id')) links.createIndex('target_id', 'target_id');
      if (!links.indexNames.contains('source_id')) links.createIndex('source_id', 'source_id');
      const highlights = make('highlights', { keyPath: ['translation', 'reference'] });
      if (!highlights.indexNames.contains('book')) highlights.createIndex('book', ['translation', 'book']);
      make('bookmarks', { keyPath: 'id' });
      make('study_tabs', { keyPath: 'id' });
      make('reading_history', { keyPath: 'id', autoIncrement: true });
      const attachments = make('attachments', { keyPath: 'id' });
      if (!attachments.indexNames.contains('note_id')) attachments.createIndex('note_id', 'note_id');
      const cards = make('flashcards', { keyPath: 'id' });
      if (!cards.indexNames.contains('due')) cards.createIndex('due', 'due');
      make('review_history', { keyPath: 'id' });
      make('learning_progress', { keyPath: 'id' });
      make('user_modules', { keyPath: 'id' });
      make('user_module_data', { keyPath: ['module', 'key'] });
      make('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(new StorageUnavailableError(request.error?.message ?? 'IndexedDB indisponível'));
    request.onblocked = () => reject(new StorageUnavailableError('Outra aba mantém o banco local aberto.'));
  });
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

/** Apenas para testes. */
export function resetDbConnection(): void {
  opening = null;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha na transação'));
    tx.onabort = () => reject(tx.error ?? new DOMException('Transação cancelada', 'AbortError'));
  });
}

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

export async function getAll<T>(store: StoreName, query?: IDBKeyRange | IDBValidKey, index?: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const source = index ? tx.objectStore(store).index(index) : tx.objectStore(store);
  return req(source.getAll(query) as IDBRequest<T[]>);
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return req(db.transaction(store, 'readonly').objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function count(store: StoreName): Promise<number> {
  const db = await openDb();
  return req(db.transaction(store, 'readonly').objectStore(store).count());
}

/**
 * Executa várias operações numa única transação atômica: ou tudo é gravado,
 * ou nada (equivalente ao BEGIN/COMMIT do aplicativo original).
 */
export async function write(stores: StoreName[], body: (tx: IDBTransaction) => void | Promise<void>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(stores, 'readwrite');
  const finished = done(tx);
  try {
    await body(tx);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* já encerrada */
    }
    await finished.catch(() => undefined);
    throw error;
  }
  try {
    await finished;
  } catch (error) {
    throw translateQuota(error);
  }
}

export function translateQuota(error: unknown): unknown {
  const name = (error as { name?: string })?.name;
  if (name === 'QuotaExceededError') {
    return new StorageUnavailableError(
      'O armazenamento do navegador está cheio. Libere espaço (Configurações → Armazenamento) ou remova pacotes offline.',
    );
  }
  return error;
}

export const put = (store: StoreName, value: unknown) => write([store], (tx) => void tx.objectStore(store).put(value));
export const del = (store: StoreName, key: IDBValidKey | IDBKeyRange) =>
  write([store], (tx) => void tx.objectStore(store).delete(key));
export const clear = (store: StoreName) => write([store], (tx) => void tx.objectStore(store).clear());

export const requestValue = req;
