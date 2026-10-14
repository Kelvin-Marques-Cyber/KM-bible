// Núcleo puro dos pacotes .biblepkg: port fiel de ContentPackage.parse/install
// e validateGlb (lib/packages.dart). Roda tanto no Web Worker quanto na thread
// principal, por isso importa apenas módulos sem efeitos colaterais (fflate,
// domain, db). As mensagens ficam em códigos traduzíveis (PackageError.code).
import { unzipSync } from 'fflate';
import type { RawCommentary, RawDocument, RawVerse, UserModule, VerseMeta } from './content';
import { openDb } from './db';
import { fromId, refKey, refLabel, type Ref } from './domain';

export const PACKAGE_KINDS = ['bible', 'commentary', 'dictionary', 'confession', 'lexicon', 'atlas', 'model', 'study'] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

/** Versão do aplicativo usada para conferir min_app_version dos pacotes. */
export const PACKAGE_APP_VERSION = [0, 5, 4] as const;
export const MAX_PACKAGE_BYTES = 80 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 240 * 1024 * 1024;
export const MAX_RECORDS = 500_000;
export const MAX_GLB_BYTES = 20 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const REQUIRED = ['title', 'version', 'language', 'author', 'license', 'license_text', 'source'] as const;

// ------------------------------------------------------------------ erros
const MESSAGES = {
  too_large: ['O pacote excede 80 MB.', 'Package exceeds 80 MB.', 'El paquete supera 80 MB.'],
  invalid_zip: [
    'O arquivo não é um pacote .biblepkg válido (ZIP corrompido ou incompleto).',
    'The file is not a valid .biblepkg package (corrupt or incomplete ZIP).',
    'El archivo no es un paquete .biblepkg válido (ZIP dañado o incompleto).',
  ],
  unsafe_path: ['Caminho inseguro ou duplicado no pacote.', 'Unsafe or duplicate path.', 'Ruta insegura o duplicada en el paquete.'],
  expanded_too_large: [
    'O conteúdo descompactado do pacote é grande demais (limite de 240 MB).',
    'Expanded package too large (240 MB limit).',
    'El contenido descomprimido es demasiado grande (límite de 240 MB).',
  ],
  missing_manifest: ['O pacote não contém manifest.json.', 'Missing manifest.', 'Falta manifest.json en el paquete.'],
  invalid_json: ['JSON inválido em {}.', 'Invalid JSON in {}.', 'JSON no válido en {}.'],
  unsupported: [
    'Pacote não suportado (formato, tipo ou identificador inválido).',
    'Unsupported package (format, kind or identifier).',
    'Paquete no compatible (formato, tipo o identificador no válido).',
  ],
  missing_field: ['Campo obrigatório ausente no manifesto: {}.', 'Missing {}.', 'Falta el campo obligatorio {}.'],
  invalid_dependencies: ['Lista de dependências inválida.', 'Invalid dependencies.', 'Lista de dependencias no válida.'],
  invalid_min_version: ['Versão mínima do aplicativo inválida.', 'Invalid minimum app version.', 'Versión mínima de la aplicación no válida.'],
  newer_app: [
    'O pacote exige uma versão mais recente do aplicativo.',
    'Package needs a newer application.',
    'El paquete requiere una versión más reciente de la aplicación.',
  ],
  missing_hashes: [
    'O manifesto não traz os hashes SHA-256 dos arquivos.',
    'Missing file hashes.',
    'El manifiesto no incluye los hashes SHA-256 de los archivos.',
  ],
  integrity: ['Falha de integridade (SHA-256): {}.', 'Integrity failure: {}.', 'Fallo de integridad (SHA-256): {}.'],
  unexpected_file: ['Arquivo inesperado no pacote: {}.', 'Unexpected file: {}.', 'Archivo inesperado en el paquete: {}.'],
  missing_records: [
    'O pacote não contém os registros ({}).',
    'Missing records ({}).',
    'El paquete no contiene los registros ({}).',
  ],
  invalid_records: [
    'Lista de registros inválida (máximo de 500 000 registros).',
    'Invalid record list (500,000 records maximum).',
    'Lista de registros no válida (máximo de 500 000).',
  ],
  invalid_verse: ['Versículo inválido ou duplicado: {}.', 'Invalid or duplicate verse: {}.', 'Versículo no válido o duplicado: {}.'],
  invalid_metadata: ['Metadados inválidos: {}.', 'Invalid metadata: {}.', 'Metadatos no válidos: {}.'],
  invalid_heading: ['Título de seção inválido: {}.', 'Invalid heading: {}.', 'Título de sección no válido: {}.'],
  invalid_red_range: [
    'Intervalo de palavras de Jesus inválido: {}.',
    'Invalid red range: {}.',
    'Intervalo de palabras de Jesús no válido: {}.',
  ],
  invalid_record_id: [
    'Identificador de registro inválido ou duplicado: {}.',
    'Invalid record ID: {}.',
    'Identificador de registro no válido o duplicado: {}.',
  ],
  invalid_commentary: ['Intervalo de comentário inválido: {}.', 'Invalid commentary range: {}.', 'Intervalo de comentario no válido: {}.'],
  invalid_document: [
    'Documento inválido (título e texto são obrigatórios): {}.',
    'Invalid document: {}.',
    'Documento no válido (título y texto obligatorios): {}.',
  ],
  invalid_lexeme: ['Verbete léxico inválido (lema e glosa): {}.', 'Invalid lexeme: {}.', 'Entrada léxica no válida (lema y glosa): {}.'],
  invalid_occurrence: ['Ocorrência de palavra inválida: {}.', 'Invalid word occurrence: {}.', 'Ocurrencia de palabra no válida: {}.'],
  invalid_coordinates: ['Coordenadas inválidas: {}.', 'Invalid coordinates: {}.', 'Coordenadas no válidas: {}.'],
  invalid_date: ['Data inválida (não existe ano zero): {}.', 'Invalid date (there is no year zero): {}.', 'Fecha no válida (no existe el año cero): {}.'],
  missing_glb: ['Modelo GLB ausente: {}.', 'Missing GLB: {}.', 'Falta el modelo GLB: {}.'],
  invalid_glb_size: ['Tamanho de GLB inválido (máximo de 20 MB).', 'Invalid GLB size (20 MB maximum).', 'Tamaño de GLB no válido (máximo 20 MB).'],
  invalid_glb_header: ['Cabeçalho GLB inválido.', 'Invalid GLB header.', 'Encabezado GLB no válido.'],
  invalid_glb_chunk: ['Bloco GLB inválido.', 'Invalid GLB chunk.', 'Bloque GLB no válido.'],
  invalid_glb_length: ['Comprimento de bloco GLB inválido.', 'Invalid GLB length.', 'Longitud de bloque GLB no válida.'],
  unsupported_gltf: [
    'glTF não suportado (exige glTF 2.0 sem extensões obrigatórias).',
    'Unsupported glTF (glTF 2.0 without required extensions).',
    'glTF no compatible (requiere glTF 2.0 sin extensiones obligatorias).',
  ],
  external_glb: [
    'Recursos externos no modelo 3D não são permitidos.',
    'External model resources prohibited.',
    'No se permiten recursos externos en el modelo 3D.',
  ],
  invalid_mapping: ['Correspondência de versículos inválida.', 'Invalid verse mapping.', 'Correspondencia de versículos no válida.'],
  missing_dependency: [
    'Dependência ausente: {}. Instale primeiro o módulo exigido.',
    'Missing dependency: {}. Install the required module first.',
    'Falta la dependencia: {}. Instale primero el módulo requerido.',
  ],
  quota: [
    'Não há espaço suficiente no armazenamento do navegador para instalar este módulo. Libere espaço no aparelho ou remova pacotes em Biblioteca → Conteúdo offline e tente de novo.',
    'There is not enough browser storage to install this module. Free up space or remove packs in Library → Offline content and try again.',
    'No hay espacio suficiente en el almacenamiento del navegador para instalar este módulo. Libere espacio o quite paquetes en Biblioteca → Contenido sin conexión e inténtelo de nuevo.',
  ],
  storage: [
    'Não foi possível gravar o módulo no aparelho: {}',
    'Could not save the module on this device: {}',
    'No se pudo guardar el módulo en el dispositivo: {}',
  ],
} satisfies Record<string, [string, string, string]>;

export type PackageErrorCode = keyof typeof MESSAGES;
const format = (text: string, detail: string) => (text.includes('{}') ? text.replace('{}', detail || '—') : text);

/** Equivalente ao FormatException do original, com código traduzível. */
export class PackageError extends Error {
  readonly code: PackageErrorCode;
  readonly detail: string;
  constructor(code: PackageErrorCode, detail = '') {
    super(format(MESSAGES[code][0], detail));
    this.name = 'PackageError';
    this.code = code;
    this.detail = detail;
  }
}

export function isPackageErrorCode(code: unknown): code is PackageErrorCode {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

/** Mensagem no idioma da interface (pt, en ou es). */
export function packageErrorText(error: unknown, language: 'pt' | 'en' | 'es' = 'pt'): string {
  if (error instanceof PackageError || (error && isPackageErrorCode((error as PackageError).code))) {
    const e = error as PackageError;
    return format(MESSAGES[e.code][language === 'en' ? 1 : language === 'es' ? 2 : 0], e.detail ?? '');
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

// ------------------------------------------------------------- utilidades
type Json = Record<string, unknown>;
const isMap = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Ausente ou lista (campos opcionais percorridos por content.ts). */
const optionalList = (v: unknown) => v === undefined || v === null || Array.isArray(v);
const text = (v: unknown, fallback: string) => (typeof v === 'string' ? v : v === null || v === undefined ? fallback : String(v));
const describe = (row: Json, fallback: number) => text(row.id ?? row.reference, `#${fallback + 1}`).slice(0, 80);

const decoder = () => new TextDecoder('utf-8', { fatal: true });
function decodeJson(bytes: Uint8Array, name: string): unknown {
  try {
    return JSON.parse(decoder().decode(bytes));
  } catch {
    throw new PackageError('invalid_json', name);
  }
}

/** Referência estrita como Reference.fromId do original (texto obrigatório). */
const refOf = (v: unknown): Ref | null => (typeof v === 'string' ? fromId(v) : null);

// --------------------------------------------------------------- SHA-256
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 em JavaScript: reserva para contextos sem crypto.subtle (http em rede local). */
export function sha256Fallback(data: Uint8Array): string {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const length = data.length;
  const total = Math.ceil((length + 9) / 64) * 64;
  const w = new Uint32Array(64);
  const tail = new Uint8Array(total - Math.floor(length / 64) * 64);
  const fullBlocks = Math.floor(length / 64);
  tail.set(data.subarray(fullBlocks * 64));
  tail[length - fullBlocks * 64] = 0x80;
  const bits = length * 8;
  const tv = new DataView(tail.buffer);
  tv.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
  tv.setUint32(tail.length - 4, bits >>> 0);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const blocks = total / 64;
  for (let block = 0; block < blocks; block++) {
    const inTail = block >= fullBlocks;
    const view = inTail ? tv : dv;
    const base = inTail ? (block - fullBlocks) * 64 : block * 64;
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(base + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return [...h].map((x) => x.toString(16).padStart(8, '0')).join('');
}

export async function sha256(data: Uint8Array): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', data as unknown as BufferSource);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      /* contexto inseguro ou implementação parcial: usa a reserva */
    }
  }
  return sha256Fallback(data);
}

// ----------------------------------------------------------------- GLB
/** Port de validateGlb (lib/packages.dart). */
export function validateGlb(bytes: Uint8Array): void {
  if (bytes.length < 20 || bytes.length > MAX_GLB_BYTES) throw new PackageError('invalid_glb_size');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) {
    throw new PackageError('invalid_glb_header');
  }
  let offset = 12;
  let document: Json | null = null;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new PackageError('invalid_glb_chunk');
    const size = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + size > bytes.length) throw new PackageError('invalid_glb_length');
    if (type === 0x4e4f534a) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(decoder().decode(bytes.subarray(offset, offset + size)).trim());
      } catch {
        throw new PackageError('unsupported_gltf');
      }
      if (!isMap(parsed)) throw new PackageError('unsupported_gltf');
      document = parsed;
    }
    offset += size;
  }
  const asset = document?.asset;
  const required = document?.extensionsRequired;
  if (
    !document ||
    !isMap(asset) ||
    asset.version !== '2.0' ||
    (required !== undefined && required !== null && (!Array.isArray(required) || required.length > 0))
  ) {
    throw new PackageError('unsupported_gltf');
  }
  for (const key of ['buffers', 'images']) {
    const list = document[key];
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) throw new PackageError('unsupported_gltf');
    if (list.some((e) => isMap(e) && e.uri !== undefined && e.uri !== null)) throw new PackageError('external_glb');
  }
}

// ------------------------------------------------------------- análise
export interface PackageManifest {
  format_version: number;
  id: string;
  kind: PackageKind;
  title: string;
  version: string;
  language: string;
  author: string;
  license: string;
  license_text: string;
  source: string;
  dependencies: string[];
  min_app_version?: string;
  metadata?: Json;
  files?: Record<string, string>;
  mappings?: unknown;
  [key: string]: unknown;
}

export interface ParsedPackage {
  manifest: PackageManifest;
  records: Json[];
  files: Map<string, Uint8Array>;
  /** Tamanho do arquivo .biblepkg. */
  bytes: number;
  /** Soma dos arquivos descompactados. */
  expanded: number;
}

export type PackageStage = 'read' | 'unzip' | 'verify' | 'validate' | 'prepare' | 'write';

export function isSafePath(name: string): boolean {
  return !(
    name.startsWith('/') ||
    name.includes('\\') ||
    name.split('/').some((s) => s === '..' || s === '') ||
    name.includes(':')
  );
}

/** Compara versões semânticas (a > b → 1). */
export function compareVersions(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return 1;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return -1;
  }
  return 0;
}

function unzip(bytes: Uint8Array): { files: Map<string, Uint8Array>; expanded: number } {
  const seen = new Set<string>();
  let declared = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        // Pastas não são arquivos (file.isFile do original).
        if (file.name.endsWith('/') && file.originalSize === 0) return false;
        if (!isSafePath(file.name) || seen.has(file.name)) throw new PackageError('unsafe_path', file.name);
        seen.add(file.name);
        declared += file.originalSize;
        if (declared > MAX_EXPANDED_BYTES) throw new PackageError('expanded_too_large');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof PackageError) throw error;
    throw new PackageError('invalid_zip', error instanceof Error ? error.message : String(error));
  }
  const files = new Map<string, Uint8Array>();
  let expanded = 0;
  for (const [name, data] of Object.entries(entries)) {
    expanded += data.length;
    if (expanded > MAX_EXPANDED_BYTES) throw new PackageError('expanded_too_large');
    files.set(name, data);
  }
  return { files, expanded };
}

function checkManifest(m: Json): PackageManifest {
  if (m.format_version !== 1 || !PACKAGE_KINDS.includes(m.kind as PackageKind) || typeof m.id !== 'string' || !ID_PATTERN.test(m.id)) {
    throw new PackageError('unsupported');
  }
  for (const key of REQUIRED) {
    if (typeof m[key] !== 'string' || !(m[key] as string).trim()) throw new PackageError('missing_field', key);
  }
  if (!Array.isArray(m.dependencies) || m.dependencies.some((v) => typeof v !== 'string')) {
    throw new PackageError('invalid_dependencies');
  }
  const min = m.min_app_version;
  if (min !== undefined && min !== null) {
    if (typeof min !== 'string' || !/^\d+\.\d+\.\d+$/.test(min)) throw new PackageError('invalid_min_version');
    if (compareVersions(min.split('.').map(Number), PACKAGE_APP_VERSION) > 0) throw new PackageError('newer_app');
  }
  if (!isMap(m.files)) throw new PackageError('missing_hashes');
  return m as PackageManifest;
}

function validateRecord(kind: PackageKind, row: Json, index: number, keys: Set<string>, files: Map<string, Uint8Array>): void {
  if (kind === 'bible') {
    const r = refOf(row.reference);
    const label = describe(row, index);
    if (!r || typeof row.text !== 'string' || !row.text || keys.has(`${r.book}:${r.chapter}:${r.verse}`)) {
      throw new PackageError('invalid_verse', label);
    }
    keys.add(`${r.book}:${r.chapter}:${r.verse}`);
    const metadata = row.metadata ?? {};
    if (!isMap(metadata)) throw new PackageError('invalid_metadata', label);
    if (metadata.heading !== undefined && metadata.heading !== null && typeof metadata.heading !== 'string') {
      throw new PackageError('invalid_heading', label);
    }
    const ranges = metadata.red_ranges ?? [];
    if (!Array.isArray(ranges)) throw new PackageError('invalid_red_range', label);
    for (const range of ranges) {
      if (
        !Array.isArray(range) ||
        range.length !== 2 ||
        range.some((v) => !isInt(v)) ||
        range[0] < 0 ||
        range[1] > row.text.length ||
        range[0] >= range[1]
      ) {
        throw new PackageError('invalid_red_range', label);
      }
    }
    return;
  }
  if (typeof row.id !== 'string' || keys.has(row.id)) throw new PackageError('invalid_record_id', describe(row, index));
  keys.add(row.id);
  const label = row.id.slice(0, 80);
  if (kind === 'commentary') {
    const a = refOf(row.reference);
    const b = refOf(row.end_reference ?? row.reference);
    if (!a || !b || refKey(b) < refKey(a) || typeof row.body !== 'string') throw new PackageError('invalid_commentary', label);
  } else if (kind === 'dictionary' || kind === 'confession' || kind === 'study') {
    if (typeof row.title !== 'string' || typeof row.body !== 'string') throw new PackageError('invalid_document', label);
  } else if (kind === 'lexicon') {
    if (typeof row.lemma !== 'string' || typeof row.gloss !== 'string') throw new PackageError('invalid_lexeme', label);
  } else if (kind === 'atlas') {
    // O original valida "places"; o atlas (loadContext) desenha "locations" e
    // "events" de {...metadata, ...registro}: tudo passa pela mesma conferência.
    const meta = isMap(row.metadata) ? row.metadata : {};
    const places = row.places ?? [];
    const locations = row.locations ?? meta.locations ?? [];
    if (!Array.isArray(places) || !Array.isArray(locations)) throw new PackageError('invalid_coordinates', label);
    for (const place of [...places, ...locations]) {
      const lat = isMap(place) ? place.lat : undefined;
      const lon = isMap(place) ? place.lon : undefined;
      if (!isNum(lat) || !isNum(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new PackageError('invalid_coordinates', label);
      }
    }
    const events = row.events ?? meta.events ?? [];
    if (!Array.isArray(events)) throw new PackageError('invalid_date', label);
    for (const event of events) {
      if (!isMap(event)) throw new PackageError('invalid_date', label);
      for (const v of [event.start, event.end]) {
        if (v !== undefined && v !== null && (!isInt(v) || v === 0)) throw new PackageError('invalid_date', label);
      }
      if (!optionalList(event.references)) throw new PackageError('invalid_metadata', label);
    }
  } else if (kind === 'model') {
    const glb = typeof row.file === 'string' ? files.get(row.file) : undefined;
    if (!glb) throw new PackageError('missing_glb', text(row.file, label));
    validateGlb(glb);
    // loadModels percorre estas listas: um valor que não seja lista quebraria a tela 3D.
    const meta = isMap(row.metadata) ? row.metadata : {};
    if (!optionalList(row.references ?? meta.references) || !optionalList(row.layers ?? meta.layers)) {
      throw new PackageError('invalid_metadata', label);
    }
  }
}

/** ContentPackage.parse: valida o .biblepkg inteiro antes de qualquer gravação. */
export async function parsePackage(input: Uint8Array | ArrayBuffer, onStage?: (stage: PackageStage) => void): Promise<ParsedPackage> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > MAX_PACKAGE_BYTES) throw new PackageError('too_large');
  onStage?.('unzip');
  const { files, expanded } = unzip(bytes);
  const raw = files.get('manifest.json');
  if (!raw) throw new PackageError('missing_manifest');
  const parsed = decodeJson(raw, 'manifest.json');
  if (!isMap(parsed)) throw new PackageError('unsupported');
  const manifest = checkManifest(parsed);

  onStage?.('verify');
  const hashes = manifest.files as Record<string, unknown>;
  for (const [name, expected] of Object.entries(hashes)) {
    const payload = files.get(name);
    if (!payload || typeof expected !== 'string' || expected !== (await sha256(payload))) {
      throw new PackageError('integrity', name);
    }
  }
  for (const name of files.keys()) {
    if (name !== 'manifest.json' && !Object.prototype.hasOwnProperty.call(hashes, name)) throw new PackageError('unexpected_file', name);
  }

  onStage?.('validate');
  const recordsName = manifest.kind === 'bible' ? 'verses.json' : 'data.json';
  const payload = files.get(recordsName);
  if (!payload) throw new PackageError('missing_records', recordsName);
  const values = decodeJson(payload, recordsName);
  if (!Array.isArray(values) || values.length > MAX_RECORDS) throw new PackageError('invalid_records');
  const keys = new Set<string>();
  values.forEach((row, index) => {
    if (!isMap(row)) throw new PackageError('invalid_records');
    validateRecord(manifest.kind, row, index, keys, files);
  });
  // Os registros já foram lidos: libera a cópia descompactada (memória em aparelhos modestos).
  files.delete(recordsName);
  return { manifest, records: values as Json[], files, bytes: bytes.length, expanded };
}

// ---------------------------------------------------------- instalação
export interface ModuleDataRow {
  module: string;
  key: string;
  value: unknown;
}
export type UserModuleRecord = UserModule & { records: number };
export interface InstallPlan {
  record: UserModuleRecord;
  rows: ModuleDataRow[];
}

/** Manifesto como fica guardado: sem o mapa de hashes dos arquivos. */
export function storedManifest(manifest: PackageManifest): UserModule['manifest'] {
  const copy: Json = { ...manifest };
  delete copy.files;
  return copy as UserModule['manifest'];
}

function compactMeta(metadata: unknown): VerseMeta | undefined {
  if (!isMap(metadata)) return undefined;
  const compact: VerseMeta = {};
  if (typeof metadata.heading === 'string' && metadata.heading) compact.h = metadata.heading;
  if (Array.isArray(metadata.red_ranges) && metadata.red_ranges.length) compact.r = metadata.red_ranges as [number, number][];
  if (metadata.paragraph === true) compact.p = 1;
  if (Array.isArray(metadata.notes) && metadata.notes.length) compact.n = metadata.notes;
  return Object.keys(compact).length ? compact : undefined;
}

function bibleRows(id: string, records: Json[]) {
  const byBook = new Map<number, Map<number, RawVerse[]>>();
  for (const row of records) {
    const r = refOf(row.reference)!;
    const meta = compactMeta(row.metadata);
    const verse: RawVerse = meta ? [r.verse, row.text as string, meta] : [r.verse, row.text as string];
    let chapters = byBook.get(r.book);
    if (!chapters) byBook.set(r.book, (chapters = new Map()));
    let list = chapters.get(r.chapter);
    if (!list) chapters.set(r.chapter, (list = []));
    list.push(verse);
  }
  const rows: ModuleDataRow[] = [];
  const books: Record<string, number[]> = {};
  for (const book of [...byBook.keys()].sort((a, b) => a - b)) {
    const chapters = byBook.get(book)!;
    const last = Math.max(...chapters.keys());
    const c: RawVerse[][] = [];
    const maxima: number[] = [];
    for (let chapter = 1; chapter <= last; chapter++) {
      const list = (chapters.get(chapter) ?? []).sort((a, b) => a[0] - b[0]);
      c.push(list);
      maxima.push(list.length ? list[list.length - 1][0] : 0);
    }
    books[String(book)] = maxima;
    rows.push({ module: id, key: `b:${book}`, value: { b: book, c } });
  }
  return { rows, books };
}

function mappingRows(manifest: PackageManifest): NonNullable<UserModule['mappings']> {
  const raw = manifest.mappings ?? [];
  if (!Array.isArray(raw)) throw new PackageError('invalid_mapping');
  return raw.map((row) => {
    const a = isMap(row) ? refOf(row.source_reference) : null;
    const b = isMap(row) ? refOf(row.target_reference) : null;
    if (!a || !b || !isMap(row) || typeof row.target_translation !== 'string') throw new PackageError('invalid_mapping');
    return {
      source_reference: `${a.book}:${a.chapter}:${a.verse}`,
      target_translation: row.target_translation,
      target_reference: `${b.book}:${b.chapter}:${b.verse}`,
      kind: text(row.kind, 'editorial'),
    };
  });
}

function commentaryRows(manifest: PackageManifest, records: Json[]) {
  const id = manifest.id;
  const byBook = new Map<number, RawCommentary[]>();
  for (const row of records) {
    const a = refOf(row.reference)!;
    const b = refOf(row.end_reference ?? row.reference)!;
    const item: RawCommentary = [
      `${id}:${row.id as string}`,
      refKey(a),
      refKey(b),
      text(row.title, refLabel(a, 'pt')),
      row.body as string,
      text(row.commentary_kind, 'exegesis'),
      text(row.bibliography, manifest.title),
    ];
    // Um comentário que atravessa livros aparece em cada livro do intervalo.
    for (let book = a.book; book <= b.book; book++) {
      let list = byBook.get(book);
      if (!list) byBook.set(book, (list = []));
      list.push(item);
    }
  }
  const books = [...byBook.keys()].sort((x, y) => x - y);
  const rows = books.map((book) => ({
    module: id,
    key: `c:${book}`,
    value: byBook.get(book)!.sort((x, y) => x[1] - y[1] || x[2] - y[2]),
  }));
  return { rows, books };
}

async function documentRows(manifest: PackageManifest, records: Json[], files: Map<string, Uint8Array>) {
  const id = manifest.id;
  const kind = manifest.kind;
  const docs: RawDocument[] = [];
  const blobs = new Map<string, ModuleDataRow>();
  for (const row of records) {
    if (row.metadata !== undefined && row.metadata !== null && !isMap(row.metadata)) {
      throw new PackageError('invalid_metadata', text(row.id, ''));
    }
    const meta: Json = { ...((row.metadata as Json | undefined) ?? {}) };
    if (kind === 'model') {
      const bytes = files.get(row.file as string)!;
      const key = `glb:${await sha256(bytes)}`;
      if (!blobs.has(key)) {
        blobs.set(key, { module: id, key, value: new Blob([bytes as unknown as BlobPart], { type: 'model/gltf-binary' }) });
      }
      Object.assign(meta, row);
      meta.local_key = key;
    } else if (kind === 'atlas') {
      Object.assign(meta, row);
    }
    docs.push([
      `${id}:${row.id as string}`,
      kind,
      text(row.title, manifest.title),
      text(row.body, ''),
      text(row.reference, ''),
      meta,
    ]);
  }
  return [{ module: id, key: 'docs', value: docs }, ...blobs.values()];
}

function lexiconRows(id: string, records: Json[]): ModuleDataRow[] {
  for (const row of records) {
    const occurrences = row.occurrences ?? [];
    if (!Array.isArray(occurrences)) throw new PackageError('invalid_occurrence', String(row.id));
    for (const w of occurrences) {
      if (!isMap(w) || !refOf(w.reference) || typeof w.surface !== 'string' || !isInt(w.position)) {
        throw new PackageError('invalid_occurrence', String(row.id));
      }
    }
  }
  return [{ module: id, key: 'lexicon', value: records }];
}

/** Converte o pacote validado nos registros do IndexedDB (ContentPackage.install). */
export async function buildInstallPlan(pkg: ParsedPackage, now = Date.now()): Promise<InstallPlan> {
  const { manifest, records } = pkg;
  const record: UserModuleRecord = {
    id: manifest.id,
    manifest: storedManifest(manifest),
    enabled: true,
    installedAt: now,
    bytes: pkg.bytes,
    records: records.length,
  };
  let rows: ModuleDataRow[];
  if (manifest.kind === 'bible') {
    const bible = bibleRows(manifest.id, records);
    rows = bible.rows;
    record.books = bible.books;
    record.mappings = mappingRows(manifest);
  } else if (manifest.kind === 'commentary') {
    const commentary = commentaryRows(manifest, records);
    rows = commentary.rows;
    record.commentaryBooks = commentary.books;
  } else if (manifest.kind === 'lexicon') {
    rows = lexiconRows(manifest.id, records);
  } else {
    rows = await documentRows(manifest, records, pkg.files);
  }
  return { record, rows };
}

/** Análise + preparação numa única chamada (usada pelo worker e pela via direta). */
export async function preparePackage(
  input: Uint8Array | ArrayBuffer,
  onStage?: (stage: PackageStage) => void,
): Promise<{ manifest: UserModule['manifest']; plan: InstallPlan }> {
  const pkg = await parsePackage(input, onStage);
  onStage?.('prepare');
  const plan = await buildInstallPlan(pkg);
  return { manifest: plan.record.manifest, plan };
}

// ------------------------------------------------------- IndexedDB
export function isQuotaError(error: unknown): boolean {
  const e = error as { name?: string; code?: number; inner?: { name?: string } } | null;
  return (
    !!e &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.inner?.name === 'QuotaExceededError')
  );
}

/** Range de todas as linhas de um módulo em user_module_data (chave [módulo, chave]). */
export const moduleRange = (id: string) => IDBKeyRange.bound([id], [id, []]);

function transaction(stores: string[], body: (tx: IDBTransaction) => void): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(stores, 'readwrite');
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Falha na transação'));
        tx.onabort = () => reject(tx.error ?? new DOMException('Transação cancelada', 'AbortError'));
        try {
          body(tx);
        } catch (error) {
          try {
            tx.abort();
          } catch {
            /* já encerrada */
          }
          reject(error);
        }
      }),
  );
}

/**
 * Grava o módulo de forma atômica: apaga os dados anteriores do mesmo id e
 * grava tudo numa única transação (BEGIN/COMMIT/ROLLBACK do original).
 */
export async function writeInstallPlan(plan: InstallPlan): Promise<void> {
  const id = plan.record.id;
  try {
    await transaction(['user_modules', 'user_module_data'], (tx) => {
      const data = tx.objectStore('user_module_data');
      data.delete(moduleRange(id));
      for (const row of plan.rows) data.put(row);
      tx.objectStore('user_modules').put(plan.record);
    });
  } catch (error) {
    if (error instanceof PackageError) throw error;
    if (isQuotaError(error)) throw new PackageError('quota');
    throw new PackageError('storage', error instanceof Error ? error.message : String(error));
  }
}

/** Apaga o registro e todos os dados de um módulo importado. */
export async function deleteModuleData(id: string): Promise<void> {
  await transaction(['user_modules', 'user_module_data'], (tx) => {
    tx.objectStore('user_module_data').delete(moduleRange(id));
    tx.objectStore('user_modules').delete(id);
  });
}
