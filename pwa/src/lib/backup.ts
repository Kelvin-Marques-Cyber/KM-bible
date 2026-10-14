// Backup e restauração 100% compatíveis com lib/backups.dart (APK, Flutter Web e PWA).
//
// Formato (.zip):
//   notes/<caderno seguro>/<id>.md   "# título" + linha em branco + corpo + "\n"
//   attachments/<id><ext>            bytes do anexo (SHA-256 conferido)
//   data.json                        { tabela: [linhas do personal.sqlite] }
//   manifest.json                    { format: 1, application: "BibliaReformadaBackup", files: { nome: sha256 } }
// Criptografado (.bibliaenc): JSON { encrypted: 1, algorithm, salt, nonce, ciphertext, mac } em base64,
// AES-256-GCM com chave PBKDF2-SHA256 (210 000 iterações) e AAD "BibliaReformadaBackup:1".
//
// O IndexedDB guarda as preferências já decodificadas ({ key, value }); no backup o valor
// volta a ser o texto JSON (jsonEncode do Dart). Destaques têm o campo extra "book" e
// anexos guardam o Blob no próprio IndexedDB.
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { getAll, requestValue, write, type StoreName } from './db';
import { uuid } from './domain';
import { tr } from './i18n';
import { wikiTargets } from './scripture';
import { emit, invalidateNotes, loadPrefs, loadProgress, sha256Hex, type Attachment, type Note } from './store';

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

const STORE_OF: Record<BackupTable, StoreName> = {
  preferences: 'prefs',
  notes: 'notes',
  note_links: 'note_links',
  highlights: 'highlights',
  bookmarks: 'bookmarks',
  study_tabs: 'study_tabs',
  reading_history: 'reading_history',
  attachments: 'attachments',
  flashcards: 'flashcards',
  review_history: 'review_history',
  learning_progress: 'learning_progress',
};

const MB = 1024 * 1024;
export const BACKUP_LIMITS = { export: 150 * MB, input: 205 * MB, expanded: 300 * MB, attachment: 20 * MB } as const;
export const BACKUP_APPLICATION = 'BibliaReformadaBackup';
export const BACKUP_ALGORITHM = 'AES-256-GCM+PBKDF2-SHA256-210000';
export const BACKUP_AAD = 'BibliaReformadaBackup:1';
export const PBKDF2_ITERATIONS = 210_000;

export type BackupErrorCode =
  | 'tooLarge'
  | 'exportTooLarge'
  | 'shortPassword'
  | 'passwordRequired'
  | 'invalidEncrypted'
  | 'wrongPassword'
  | 'invalidZip'
  | 'unsafe'
  | 'incomplete'
  | 'unsupported'
  | 'unexpectedFile'
  | 'integrity'
  | 'unknownTable'
  | 'invalidTable'
  | 'invalidRow'
  | 'invalidId'
  | 'missingAttachment'
  | 'attachmentIntegrity'
  | 'attachmentConflict';

export class BackupError extends Error {
  constructor(
    public code: BackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

function fail(code: BackupErrorCode, detail = ''): never {
  const d = detail ? `: ${detail}` : '';
  const messages: Record<BackupErrorCode, string> = {
    tooLarge: tr('Backup grande demais (limite de 205 MB).', 'Backup too large (205 MB limit).', 'Copia demasiado grande (límite de 205 MB).'),
    exportTooLarge: tr('O backup excede 150 MB.', 'Backup exceeds 150 MB.', 'La copia supera 150 MB.'),
    shortPassword: tr('Use pelo menos oito caracteres na senha.', 'Use at least eight characters.', 'Use al menos ocho caracteres.'),
    passwordRequired: tr(
      'Este backup é criptografado: informe a senha do arquivo.',
      'This backup is encrypted: enter the file password.',
      'Esta copia está cifrada: introduzca la contraseña del archivo.',
    ),
    invalidEncrypted: tr('Backup criptografado inválido.', 'Invalid encrypted backup.', 'Copia cifrada no válida.'),
    wrongPassword: tr(
      'Senha incorreta ou arquivo alterado.',
      'Wrong password or modified file.',
      'Contraseña incorrecta o archivo alterado.',
    ),
    invalidZip: tr(
      'O arquivo não é um backup válido (.zip ou .bibliaenc).',
      'The file is not a valid backup (.zip or .bibliaenc).',
      'El archivo no es una copia válida (.zip o .bibliaenc).',
    ),
    unsafe: tr('Backup inseguro', 'Unsafe backup', 'Copia insegura'),
    incomplete: tr('Backup incompleto', 'Incomplete backup', 'Copia incompleta'),
    unsupported: tr('Formato de backup não suportado', 'Unsupported backup', 'Formato de copia no compatible'),
    unexpectedFile: tr('Arquivo inesperado no backup', 'Unexpected backup file', 'Archivo inesperado en la copia'),
    integrity: tr('Falha de integridade', 'Integrity failure', 'Fallo de integridad'),
    unknownTable: tr('Tabela de dados desconhecida', 'Unknown data table', 'Tabla de datos desconocida'),
    invalidTable: tr('Dados de tabela inválidos', 'Invalid table data', 'Datos de tabla no válidos'),
    invalidRow: tr('Linha de dados inválida', 'Invalid data row', 'Fila de datos no válida'),
    invalidId: tr('Identificador inválido', 'Invalid identifier', 'Identificador no válido'),
    missingAttachment: tr('Anexo ausente', 'Missing attachment', 'Adjunto ausente'),
    attachmentIntegrity: tr('Integridade do anexo', 'Attachment integrity', 'Integridad del adjunto'),
    attachmentConflict: tr('Conflito de anexo', 'Attachment conflict', 'Conflicto de adjunto'),
  };
  const base = messages[code];
  throw new BackupError(code, base.endsWith('.') && d ? `${base.slice(0, -1)}${d}.` : `${base}${d}`);
}

// ------------------------------------------------------------------ utilidades
const encoder = new TextEncoder();
const utf8 = (s: string) => encoder.encode(s);
const decodeUtf8 = (b: Uint8Array) => new TextDecoder().decode(b);

/** Bytes de Blob/ArrayBuffer/visão tipada (inclusive de outro "realm"). */
export async function bytesOf(value: unknown): Promise<Uint8Array | null> {
  if (value === null || value === undefined) return null;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') return new Uint8Array(value as ArrayBuffer);
  const blob = value as Blob;
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  if (typeof Response !== 'undefined' && typeof blob.size === 'number') {
    try {
      return new Uint8Array(await new Response(blob).arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const step = 3 * 8192; // múltiplo de 3: os pedaços não têm preenchimento interno
  for (let i = 0; i < bytes.length; i += step) {
    const chunk = bytes.subarray(i, i + step);
    let s = '';
    for (let j = 0; j < chunk.length; j++) s += String.fromCharCode(chunk[j]);
    parts.push(btoa(s));
  }
  return parts.join('');
}

export function fromBase64(text: unknown): Uint8Array {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 !== 0) fail('invalidEncrypted');
  const out = new Uint8Array((text.length / 4) * 3 - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0));
  const step = 4 * 8192;
  let offset = 0;
  for (let i = 0; i < text.length; i += step) {
    const binary = atob(text.slice(i, i + step));
    for (let j = 0; j < binary.length; j++) out[offset++] = binary.charCodeAt(j);
  }
  return out;
}

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error(tr('Criptografia indisponível neste navegador (use HTTPS).', 'Cryptography unavailable in this browser (use HTTPS).'));
  return s;
};

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await subtle().importKey('raw', utf8(password) as BufferSource, 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Envelope .bibliaenc idêntico ao do aplicativo original. */
export async function encryptBackup(zip: Uint8Array, password: string): Promise<Uint8Array> {
  if (password.length < 8) fail('shortPassword');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const sealed = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, additionalData: utf8(BACKUP_AAD) as BufferSource, tagLength: 128 }, key, zip as BufferSource),
  );
  // WebCrypto devolve texto cifrado || etiqueta de 16 bytes; o Dart guarda a etiqueta em "mac".
  const cipherText = sealed.subarray(0, sealed.length - 16);
  const mac = sealed.subarray(sealed.length - 16);
  return utf8(
    JSON.stringify({
      encrypted: 1,
      algorithm: BACKUP_ALGORITHM,
      salt: toBase64(salt),
      nonce: toBase64(nonce),
      ciphertext: toBase64(cipherText),
      mac: toBase64(mac),
    }),
  );
}

export async function decryptBackup(bytes: Uint8Array, password: string | undefined): Promise<Uint8Array> {
  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(decodeUtf8(bytes)) as Record<string, unknown>;
  } catch {
    fail('invalidEncrypted');
  }
  if (!envelope || typeof envelope !== 'object' || envelope.encrypted !== 1 || envelope.algorithm !== BACKUP_ALGORITHM || !password) {
    fail('passwordRequired');
  }
  const salt = fromBase64(envelope.salt);
  const nonce = fromBase64(envelope.nonce);
  const mac = fromBase64(envelope.mac);
  if (salt.length !== 16 || nonce.length !== 12 || mac.length !== 16) fail('invalidEncrypted');
  const cipherText = fromBase64(envelope.ciphertext);
  const key = await deriveKey(password, salt);
  try {
    return new Uint8Array(
      await subtle().decrypt(
        { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: utf8(BACKUP_AAD) as BufferSource, tagLength: 128 },
        key,
        concat(cipherText, mac) as BufferSource,
      ),
    );
  } catch {
    fail('wrongPassword');
  }
}

/** safe() de backups.dart: letras, números, ".", "_" e "-"; no máximo 70 unidades. */
export function safeNotebook(text: string): string {
  const cleaned = text.replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const result = cleaned.substring(0, Math.min(cleaned.length, 70));
  // Caderno vazio ou "."/".." gerariam um caminho que a própria restauração recusa.
  return result === '' || result === '.' || result === '..' ? '_' : result;
}

/** p.extension() do pacote path (Dart): ".png" de "x/y.png"; "" sem extensão. */
function extension(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot <= 0 || dot === base.length - 1 ? '' : base.slice(dot);
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.zip': 'application/zip',
};
export const mimeOf = (name: string) => MIME[extension(name).toLowerCase()] ?? 'application/octet-stream';

/** Valor de coluna aceito pelo restore do Dart: texto, número ou nulo. */
function cell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value);
}

function pick(row: Record<string, unknown>, columns: readonly string[]): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const c of columns) out[c] = cell(row[c]);
  return out;
}

// ---------------------------------------------------------------- exportação
export type BackupRows = Record<BackupTable, Record<string, string | number | null>[]>;

/** Linhas no formato do personal.sqlite (SELECT * de cada tabela). */
export async function collectBackupRows(): Promise<{ rows: BackupRows; attachments: Attachment[] }> {
  const rows = {} as BackupRows;
  let attachments: Attachment[] = [];
  for (const table of BACKUP_TABLES) {
    const raw = await getAll<Record<string, unknown>>(STORE_OF[table]);
    if (table === 'preferences') {
      rows.preferences = raw.map((r) => ({ key: String(r.key), value: JSON.stringify(r.value === undefined ? null : r.value) }));
    } else if (table === 'reading_history') {
      rows.reading_history = raw.sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)).map((r) => pick(r, BACKUP_COLUMNS.reading_history));
    } else {
      if (table === 'attachments') attachments = raw as unknown as Attachment[];
      rows[table] = raw.map((r) => pick(r, BACKUP_COLUMNS[table]));
    }
  }
  return { rows, attachments };
}

export async function exportBackup(password?: string): Promise<Blob> {
  const secret = password ?? '';
  if (secret && secret.length < 8) fail('shortPassword');
  const { rows, attachments } = await collectBackupRows();
  const entries: [string, Uint8Array, number][] = [];
  const hashes: Record<string, string> = {};
  const add = async (name: string, bytes: Uint8Array, level = 6) => {
    entries.push([name, bytes, level]);
    hashes[name] = await sha256Hex(bytes);
  };
  for (const n of rows.notes) {
    await add(`notes/${safeNotebook(String(n.notebook ?? ''))}/${n.id}.md`, utf8(`# ${n.title ?? ''}\n\n${n.body ?? ''}\n`));
  }
  for (const a of attachments) {
    const bytes = await bytesOf(a.blob);
    if (!bytes) fail('missingAttachment', a.filename);
    if ((await sha256Hex(bytes)) !== a.sha256) fail('attachmentIntegrity', a.filename);
    // Imagens/PDFs já são comprimidos: guardados sem recompressão (mais rápido em celulares).
    await add(`attachments/${a.id}${extension(a.path || a.filename)}`, bytes, 0);
  }
  await add('data.json', utf8(JSON.stringify(rows)));
  entries.push(['manifest.json', utf8(JSON.stringify({ format: 1, application: BACKUP_APPLICATION, files: hashes })), 6]);
  const zippable: Zippable = {};
  for (const [name, bytes, level] of entries) zippable[name] = [bytes, { level: level as 0 | 6 }];
  const zip = zipSync(zippable);
  if (zip.length > BACKUP_LIMITS.export) fail('exportTooLarge');
  if (!secret) return new Blob([zip as BlobPart], { type: 'application/zip' });
  return new Blob([(await encryptBackup(zip, secret)) as BlobPart], { type: 'application/octet-stream' });
}

/** "Biblia-Estudos-AAAA-MM-DD.zip" (ou .bibliaenc), com a data local como no original. */
export function backupFileName(encrypted: boolean, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Biblia-Estudos-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.${encrypted ? 'bibliaenc' : 'zip'}`;
}

// --------------------------------------------------------------- restauração
/** Nomes gravados sem a marca UTF-8 do ZIP chegam em Latin-1: tenta reinterpretar. */
function canonicalName(name: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(name)) return name;
  if ([...name].some((c) => c.charCodeAt(0) > 255)) return name;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(name, (c) => c.charCodeAt(0)));
  } catch {
    return name;
  }
}

function unsafeName(name: string): boolean {
  return name.startsWith('/') || name.includes('\\') || name.includes(':') || name.split('/').some((s) => s === '..' || s === '');
}

/** Descompacta com as mesmas proteções do Dart (caminhos, duplicatas, 300 MB expandidos). */
export function readArchive(bytes: Uint8Array): Map<string, Uint8Array> {
  let expanded = 0;
  const seen = new Set<string>();
  const rename = new Map<string, string>();
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(bytes, {
      filter: (file) => {
        if (file.name.endsWith('/')) return false; // diretório
        const name = canonicalName(file.name);
        expanded += file.originalSize;
        if (expanded > BACKUP_LIMITS.expanded || unsafeName(name) || seen.has(name)) fail('unsafe');
        seen.add(name);
        rename.set(file.name, name);
        return true;
      },
    });
  } catch (error) {
    if (error instanceof BackupError) throw error;
    fail('invalidZip');
  }
  const files = new Map<string, Uint8Array>();
  let actual = 0;
  for (const [name, data] of Object.entries(raw)) {
    actual += data.length;
    if (actual > BACKUP_LIMITS.expanded) fail('unsafe');
    files.set(rename.get(name) ?? name, data);
  }
  return files;
}

type Row = Record<string, unknown>;

function validateData(data: unknown): Partial<Record<BackupTable, Row[]>> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('invalidTable');
  const tables = data as Record<string, unknown>;
  if (Object.keys(tables).some((k) => !(BACKUP_TABLES as readonly string[]).includes(k))) fail('unknownTable');
  for (const table of Object.keys(tables) as BackupTable[]) {
    const columns = BACKUP_COLUMNS[table];
    const list = tables[table];
    if (!Array.isArray(list)) fail('invalidTable');
    const idPattern = table === 'learning_progress' ? /^[A-Za-z0-9][A-Za-z0-9._:-]{0,160}$/ : /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
    for (const value of list) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalidRow');
      const keys = Object.keys(value as Row);
      if (keys.some((k) => !columns.includes(k)) || keys.length !== columns.length) fail('invalidRow');
      if (Object.values(value as Row).some((v) => v !== null && typeof v !== 'string' && typeof v !== 'number')) fail('invalidRow');
      const id = (value as Row).id;
      if (id !== null && id !== undefined && !idPattern.test(String(id))) fail('invalidId');
    }
  }
  return tables as Partial<Record<BackupTable, Row[]>>;
}

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

/** Restaura um .zip ou .bibliaenc; devolve o número de anotações restauradas. */
export async function restoreBackup(file: Blob, password?: string): Promise<number> {
  if (file.size > BACKUP_LIMITS.input) fail('tooLarge');
  let bytes = await bytesOf(file);
  if (!bytes) fail('invalidZip');
  if (bytes.length > BACKUP_LIMITS.input) fail('tooLarge');
  if (bytes.length > 0 && bytes[0] === 123) bytes = await decryptBackup(bytes, password || undefined);

  const files = readArchive(bytes);
  if (!files.has('manifest.json') || !files.has('data.json')) fail('incomplete');
  let manifest: { format?: unknown; application?: unknown; files?: unknown };
  try {
    manifest = JSON.parse(decodeUtf8(files.get('manifest.json')!)) as typeof manifest;
  } catch {
    fail('unsupported');
  }
  if (!manifest || manifest.format !== 1 || manifest.application !== BACKUP_APPLICATION) fail('unsupported');
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) fail('unsupported');
  const hashes = manifest.files as Record<string, unknown>;
  for (const name of files.keys()) if (name !== 'manifest.json' && !Object.prototype.hasOwnProperty.call(hashes, name)) fail('unexpectedFile');
  const checks = await Promise.all(
    Object.entries(hashes).map(async ([name, hash]) => {
      const content = files.get(name);
      return content !== undefined && (await sha256Hex(content)) === hash ? null : name;
    }),
  );
  const broken = checks.find((n) => n !== null);
  if (broken) fail('integrity', broken);

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(files.get('data.json')!));
  } catch {
    fail('invalidTable');
  }
  const data = validateData(parsed);

  // Anexos: conferidos antes da transação (como no Dart, antes do BEGIN).
  const existingAttachments = new Map((await getAll<Attachment>('attachments')).map((a) => [a.id, a]));
  const attachmentRows: Attachment[] = [];
  for (const value of data.attachments ?? []) {
    const id = str(value.id);
    const matches = [...files.keys()].filter((k) => k.startsWith(`attachments/${id}.`));
    if (matches.length !== 1) fail('missingAttachment', str(value.filename) || id);
    const name = matches[0];
    const content = files.get(name)!;
    if (content.length > BACKUP_LIMITS.attachment || (await sha256Hex(content)) !== value.sha256) fail('attachmentIntegrity', str(value.filename) || id);
    const current = existingAttachments.get(id);
    if (current) {
      const currentBytes = await bytesOf(current.blob);
      const currentHash = currentBytes ? await sha256Hex(currentBytes) : current.sha256;
      if (currentHash !== value.sha256) fail('attachmentConflict', str(value.filename) || id);
    }
    const path = `attachments/${name.split('/').pop()}`;
    const mime = mimeOf(name);
    attachmentRows.push({
      id,
      note_id: str(value.note_id),
      filename: str(value.filename),
      path,
      sha256: str(value.sha256),
      mime,
      blob: new Blob([content as BlobPart], { type: mime }),
    });
  }

  let count = 0;
  const restoredPrefs: { key: string; value: unknown }[] = [];
  const stores = [...new Set(BACKUP_TABLES.map((t) => STORE_OF[t]))];
  await write(stores, async (tx) => {
    const current = (await requestValue(tx.objectStore('notes').getAll())) as Note[];
    const notesById = new Map(current.map((n) => [n.id, n]));
    for (const table of BACKUP_TABLES) {
      if (table === 'note_links') continue;
      const store = tx.objectStore(STORE_OF[table]);
      if (table === 'attachments') {
        for (const a of attachmentRows) store.put(a);
        continue;
      }
      for (const value of data[table] ?? []) {
        const row = toStoreRow(table, value);
        if (!row) continue;
        if (table === 'notes') {
          const existing = notesById.get(row.id as string);
          if (existing && Number(existing.updated_at) > Number(row.updated_at)) continue;
          notesById.set(row.id as string, row as unknown as Note);
          count++;
        }
        if (table === 'preferences') restoredPrefs.push(row as { key: string; value: unknown });
        store.put(row);
      }
    }
    const links = tx.objectStore('note_links');
    links.clear();
    for (const link of linksFor([...notesById.values()])) links.put(link);
  });

  invalidateNotes();
  await loadPrefs();
  await loadProgress();
  mirrorBootPrefs(restoredPrefs);
  emit();
  return count;
}
