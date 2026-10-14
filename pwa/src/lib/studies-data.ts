// Acesso a dados da área de estudos: estudos ordenados, coleções devocionais e
// progresso de leitura. Tudo sob demanda; nada é baixado antes de ser pedido.
import { catalog } from './catalog';
import { allStudies, moduleDocuments, modules, userModule, type DocumentRow, type Study } from './content';
import { getAll } from './db';
import { completed, isCompleted } from './store';
import {
  collectionName,
  devotionalProgressId,
  isCalendarCollection,
  isDevotionalCollection,
  sortDevotionals,
  sortStudies,
  KNOWN_DEVOTIONALS,
} from './studies-logic';

// ------------------------------------------------------------------ estudos
let sorted: Promise<Study[]> | null = null;
/** Todos os estudos na ordem do original (nível, título); memorizado. */
export function sortedStudies(): Promise<Study[]> {
  if (!sorted) {
    sorted = allStudies().then(sortStudies);
    sorted.catch(() => {
      sorted = null;
    });
  }
  return sorted;
}

// --------------------------------------------------------------- devocionais
export interface Collection {
  id: string;
  name: string;
  title: string;
  author: string;
  license: string;
  source: string;
  /** Quantidade conhecida sem baixar o pacote (catálogo ou metadata.days); null = desconhecida. */
  count: number | null;
  /** Coleção por calendário (leitura de hoje = dia do ano). null = só se sabe após carregar. */
  calendar: boolean | null;
  builtin: boolean;
}

const NO_DOCS = new Set(['bible', 'commentary', 'lexicon']);

/** Coleções devocionais instaladas (embutidas e importadas), conhecidas primeiro. */
export function devotionalCollections(language: 'pt' | 'en' | 'es' = 'pt'): Collection[] {
  const rank = (id: string) => {
    const keys = Object.keys(KNOWN_DEVOTIONALS);
    const i = keys.indexOf(id);
    return i < 0 ? keys.length : i;
  };
  return modules(undefined, true)
    .filter((m) => catalog.docs.modules[m.id] || (userModule(m.id) && !NO_DOCS.has(m.kind)))
    .filter((m) => isDevotionalCollection(m))
    .map((m) => {
      const known = KNOWN_DEVOTIONALS[m.id];
      const days = typeof m.metadata?.days === 'number' ? (m.metadata.days as number) : null;
      return {
        id: m.id,
        name: collectionName(m, language),
        title: m.title,
        author: m.author,
        license: m.license,
        source: m.source,
        count: catalog.docs.modules[m.id]?.count ?? days,
        calendar: known ? known.calendar : null,
        builtin: !userModule(m.id),
      };
    })
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, 'pt'));
}

export interface LoadedCollection {
  docs: DocumentRow[];
  calendar: boolean;
}
const loaded = new Map<string, Promise<LoadedCollection>>();

/** Leituras da coleção, na ordem do calendário/dia (carregadas sob demanda e memorizadas). */
export function loadCollection(moduleId: string): Promise<LoadedCollection> {
  const user = userModule(moduleId);
  const key = `${moduleId}:${user?.installedAt ?? 0}`;
  let promise = loaded.get(key);
  if (!promise) {
    promise = moduleDocuments(moduleId).then((rows) => {
      const docs = sortDevotionals(rows);
      return { docs, calendar: isCalendarCollection(moduleId, docs) };
    });
    promise.catch(() => loaded.delete(key));
    loaded.set(key, promise);
    while (loaded.size > 6) loaded.delete(loaded.keys().next().value as string);
  }
  return promise;
}

// ------------------------------------------------------------------ progresso
/** Marcas feitas nesta sessão (garantem a contagem mesmo antes de a gravação terminar). */
const session = new Map<string, boolean>();

export const isRead = (docId: string) => isCompleted(devotionalProgressId(docId));

export async function markRead(docId: string, value: boolean): Promise<void> {
  const id = devotionalProgressId(docId);
  session.set(id, value);
  await completed(id, value);
}

/**
 * Identificadores de documentos devocionais já lidos (sem baixar os pacotes):
 * lê learning_progress e confirma cada marca no estado em memória.
 */
export async function readDocumentIds(): Promise<Set<string>> {
  const prefix = devotionalProgressId('');
  const ids = new Set<string>();
  try {
    const rows = await getAll<{ id: string; completed: number }>('learning_progress');
    for (const row of rows) if (typeof row.id === 'string' && row.id.startsWith(prefix) && isCompleted(row.id)) ids.add(row.id);
  } catch {
    /* armazenamento indisponível: usa só as marcas desta sessão */
  }
  for (const [id, value] of session) {
    if (value && isCompleted(id)) ids.add(id);
    else ids.delete(id);
  }
  return new Set([...ids].map((id) => id.slice(prefix.length)));
}

/** Quantas leituras da coleção foram marcadas. Embutidas usam o prefixo do identificador. */
export function countRead(collection: Pick<Collection, 'id'>, readIds: Set<string>, docs?: DocumentRow[]): number {
  if (docs) return docs.reduce((n, d) => n + (readIds.has(d.id) ? 1 : 0), 0);
  const prefix = `${collection.id}:`;
  let n = 0;
  for (const id of readIds) if (id.startsWith(prefix)) n++;
  return n;
}
