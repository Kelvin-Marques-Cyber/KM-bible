// Linhas do personal.sqlite (APK/Flutter) <-> registros do IndexedDB da PWA.
// Compartilhado por lib/backup.ts e lib/migration.ts, sem dependências pesadas (fflate
// fica só no backup): a migração pode rodar na abertura sem baixar o compactador.
import type { Note } from './store';
import { uuid } from './domain';
import { wikiTargets } from './scripture';

export const BACKUP_TABLES = [
  'preferences',
  'notes',
  'note_links',
  'highlights',
  'bookmarks',
  'study_tabs',
  'reading_history',
  'attachments',
  'flashcards',
  'review_history',
  'learning_progress',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Colunas de cada tabela, na ordem de Store.initPersonal() (lib/store.dart). */
export const BACKUP_COLUMNS: Record<BackupTable, readonly string[]> = {
  preferences: ['key', 'value'],
  notes: ['id', 'title', 'body', 'reference', 'notebook', 'tags', 'updated_at'],
  note_links: ['source_id', 'target_id', 'kind'],
  highlights: ['reference', 'translation', 'color'],
  bookmarks: ['id', 'reference', 'translation', 'title'],
  study_tabs: ['id', 'reference', 'translation', 'title'],
  reading_history: ['id', 'reference', 'translation', 'created_at'],
  attachments: ['id', 'note_id', 'filename', 'path', 'sha256'],
  flashcards: ['id', 'reference', 'translation', 'text', 'topic', 'mode', 'repetitions', 'interval', 'ease', 'due'],
  review_history: ['id', 'card_id', 'grade', 'reviewed_at'],
  learning_progress: ['id', 'completed', 'updated_at'],
};

/** Bytes de Blob/ArrayBuffer/visão tipada (inclusive de outro "realm"). */
export async function bytesOf(value: unknown): Promise<Uint8Array | null> {
  if (value === null || value === undefined) return null;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') return new Uint8Array(value as ArrayBuffer);
  const blob = value as Blob;
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  if (typeof blob.size !== 'number') return null;
  // Navegadores antigos (Safari < 14) não têm Blob.arrayBuffer().
  if (typeof FileReader !== 'undefined') {
    try {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
    } catch {
      /* tenta Response */
    }
  }
  if (typeof Response !== 'undefined') {
    try {
      return new Uint8Array(await new Response(blob).arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function decodePref(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Converte uma linha do personal.sqlite para o registro do IndexedDB da PWA. */
export function toStoreRow(table: BackupTable, row: Row): Row | null {
  switch (table) {
    case 'preferences':
      return typeof row.key === 'string' ? { key: row.key, value: decodePref(row.value) } : null;
    case 'notes':
      return {
        id: str(row.id) || uuid(),
        title: str(row.title),
        body: str(row.body),
        reference: str(row.reference),
        notebook: str(row.notebook),
        tags: str(row.tags),
        updated_at: num(row.updated_at),
      };
    case 'highlights': {
      const reference = str(row.reference);
      return { translation: str(row.translation), reference, color: num(row.color), book: Number(reference.split(':')[0]) || 0 };
    }
    case 'bookmarks':
    case 'study_tabs':
      return { id: str(row.id) || uuid(), reference: str(row.reference), translation: str(row.translation), title: str(row.title) };
    case 'reading_history': {
      const out: Row = { reference: str(row.reference), translation: str(row.translation), created_at: num(row.created_at) };
      const id = Number(row.id);
      if (row.id !== null && row.id !== undefined && Number.isInteger(id) && id > 0) out.id = id;
      return out;
    }
    case 'flashcards':
      return {
        id: str(row.id) || uuid(),
        reference: str(row.reference),
        translation: str(row.translation),
        text: str(row.text),
        topic: str(row.topic),
        mode: str(row.mode) || 'reference_to_text',
        repetitions: num(row.repetitions),
        interval: num(row.interval),
        ease: row.ease === null || row.ease === undefined ? 2.5 : num(row.ease),
        due: num(row.due),
      };
    case 'review_history':
      return { id: str(row.id) || uuid(), card_id: str(row.card_id), grade: num(row.grade), reviewed_at: num(row.reviewed_at) };
    case 'learning_progress':
      return { id: str(row.id), completed: num(row.completed), updated_at: num(row.updated_at) };
    default:
      return null;
  }
}

/** Preferências espelhadas em localStorage para a primeira pintura (como setPref de store.ts). */
export const BOOT_PREF_KEYS = ['theme', 'contrast', 'language', 'font_size', 'line_height', 'margins', 'font_family', 'reduced_motion'];
export function mirrorBootPrefs(prefs: { key: string; value: unknown }[]): void {
  try {
    for (const p of prefs) if (BOOT_PREF_KEYS.includes(p.key)) localStorage.setItem(`km-pref:${p.key}`, JSON.stringify(p.value));
  } catch {
    /* modo privado */
  }
}

/** Recria note_links a partir dos corpos das notas (mesma regra de saveNote). */
export function linksFor(notes: Pick<Note, 'id' | 'body'>[]): { source_id: string; target_id: string; kind: string }[] {
  const out: { source_id: string; target_id: string; kind: string }[] = [];
  for (const n of notes) {
    const seen = new Set<string>();
    for (const link of wikiTargets(n.body ?? '')) {
      if (seen.has(link.target)) continue;
      seen.add(link.target);
      out.push({ source_id: n.id, target_id: link.target, kind: link.kind });
    }
  }
  return out;
}
