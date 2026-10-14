// Importação de módulos .biblepkg (LibraryPage._install + installContentPackageOffline
// de lib/library.dart e lib/packages.dart) e ações de módulo (remover, restaurar,
// ativar, apagar). A análise pesada (unzip, SHA-256, validação e preparação dos
// registros) roda num Web Worker; a gravação no IndexedDB também, para que os
// dados descompactados nunca precisem atravessar para a thread principal.
import { builtinModule, catalog, type ModuleInfo } from './catalog';
import { loadUserModules, module, modules, userModule, type UserModule } from './content';
import { get, isMemoryOnly, put } from './db';
import { lang, tr } from './i18n';
import {
  MAX_PACKAGE_BYTES,
  PackageError,
  buildInstallPlan,
  deleteModuleData,
  isPackageErrorCode,
  packageErrorText,
  parsePackage,
  writeInstallPlan,
  type InstallPlan,
  type PackageStage,
} from './library-packages-core';
import { pref, setPref } from './store';

export {
  MAX_EXPANDED_BYTES,
  MAX_GLB_BYTES,
  MAX_PACKAGE_BYTES,
  MAX_RECORDS,
  PACKAGE_APP_VERSION,
  PACKAGE_KINDS,
  PackageError,
  buildInstallPlan,
  isSafePath,
  packageErrorText,
  parsePackage,
  preparePackage,
  sha256,
  validateGlb,
  type PackageKind,
  type PackageManifest,
  type PackageStage,
  type ParsedPackage,
} from './library-packages-core';

// ------------------------------------------------------------- rótulos
/** Filtros da biblioteca, na ordem do aplicativo original. */
export const LIBRARY_KINDS = ['', 'bible', 'commentary', 'confession', 'dictionary', 'lexicon', 'atlas', 'model', 'study'] as const;

export function kindLabel(kind: string): string {
  switch (kind) {
    case '':
      return tr('Todos', 'All', 'Todos');
    case 'bible':
      return tr('Bíblias', 'Bibles', 'Biblias');
    case 'commentary':
      return tr('Comentários', 'Commentaries', 'Comentarios');
    case 'confession':
      return tr('Confissões', 'Confessions', 'Confesiones');
    case 'dictionary':
      return tr('Dicionários', 'Dictionaries', 'Diccionarios');
    case 'lexicon':
      return tr('Léxicos', 'Lexicons', 'Léxicos');
    case 'atlas':
      return tr('Atlas', 'Atlas', 'Atlas');
    case 'model':
    case 'model_collection':
      return tr('Modelos 3D', '3D models', 'Modelos 3D');
    case 'study':
      return tr('Estudos', 'Studies', 'Estudios');
    default:
      return kind;
  }
}

/** O filtro "model" também mostra a coleção de modelos embutida (APP-3D). */
export const matchesKind = (m: Pick<ModuleInfo, 'kind'>, kind: string) =>
  !kind || m.kind === kind || (kind === 'model' && m.kind === 'model_collection');

/** Mensagens do original para quem tenta importar um PDF. */
export function pdfMessage(araInstalled: boolean): string {
  return araInstalled
    ? tr(
        'PDF não pode ser importado diretamente. A ARA já está instalada; para outros textos, use .biblepkg.',
        'PDF cannot be imported directly. ARA is already installed; for other texts, use .biblepkg.',
        'El PDF no se puede importar directamente. La ARA ya está instalada; para otros textos, use .biblepkg.',
      )
    : tr(
        'PDF não pode ser importado diretamente. Converta sua cópia autorizada em .biblepkg no computador e importe o módulo.',
        'PDF cannot be imported directly. Convert your authorized copy to .biblepkg on a computer and import the module.',
        'El PDF no se puede importar directamente. Convierta su copia autorizada en .biblepkg en el ordenador e importe el módulo.',
      );
}

export const isPdfFile = (file: { name: string; type?: string }) =>
  file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

export function stageLabel(stage: PackageStage): string {
  switch (stage) {
    case 'read':
      return tr('Lendo o arquivo…', 'Reading the file…', 'Leyendo el archivo…');
    case 'unzip':
      return tr('Descompactando o pacote…', 'Unpacking the package…', 'Descomprimiendo el paquete…');
    case 'verify':
      return tr('Conferindo a integridade (SHA-256)…', 'Checking integrity (SHA-256)…', 'Comprobando la integridad (SHA-256)…');
    case 'validate':
      return tr('Validando os registros…', 'Validating records…', 'Validando los registros…');
    case 'prepare':
      return tr('Preparando a instalação…', 'Preparing the installation…', 'Preparando la instalación…');
    case 'write':
      return tr('Gravando no aparelho…', 'Saving on this device…', 'Guardando en el dispositivo…');
  }
}

/** Texto do erro no idioma da interface. */
export const importErrorText = (error: unknown) => packageErrorText(error, lang());

// ------------------------------------------------------------ importação
export type StoredManifest = UserModule['manifest'];

export interface PreparedImport {
  manifest: StoredManifest;
  /** Número de registros (versículos, verbetes, documentos…). */
  records: number;
  /** Tamanho do arquivo .biblepkg e do conteúdo descompactado. */
  bytes: number;
  expanded: number;
  /** Módulo importado anteriormente com o mesmo identificador (será substituído). */
  previous: UserModule | undefined;
  /** Confere dependências e grava tudo numa única transação. */
  install(onStage?: (stage: PackageStage) => void): Promise<void>;
  /** Descarta os dados preparados (diálogo cancelado). */
  discard(): void;
}

/** Dependências do manifesto que não estão instaladas (installed() do original). */
export function missingDependencies(manifest: Record<string, unknown>, isInstalled: (id: string) => boolean = (id) => module(id)?.installed === true): string[] {
  const deps = Array.isArray(manifest.dependencies) ? manifest.dependencies.filter((d): d is string => typeof d === 'string') : [];
  return deps.filter((d) => !isInstalled(d));
}

function checkDependencies(manifest: StoredManifest): void {
  const missing = missingDependencies(manifest);
  if (missing.length) throw new PackageError('missing_dependency', missing.join(', '));
}

async function afterInstall(): Promise<void> {
  await loadUserModules();
  // Módulos importados não podem ser baixados de novo: pede armazenamento persistente.
  try {
    const { requestPersistence } = await import('./pwa');
    void requestPersistence();
  } catch {
    /* indisponível */
  }
}

// ---- protocolo do worker (src/workers/packages.worker.ts)
export type PackageWorkerRequest = { type: 'parse'; bytes: ArrayBuffer } | { type: 'install' } | { type: 'discard' };
export type PackageWorkerMessage =
  | { type: 'stage'; stage: PackageStage }
  | { type: 'parsed'; manifest: StoredManifest; records: number; bytes: number; expanded: number }
  | { type: 'installed' }
  | { type: 'error'; code?: string; detail?: string; message: string };

/** O worker não iniciou (navegador antigo, CSP): a importação segue na thread principal. */
class WorkerStartError extends Error {}

export function errorFromWorker(message: { code?: string; detail?: string; message: string }): Error {
  if (isPackageErrorCode(message.code)) return new PackageError(message.code, message.detail ?? '');
  return new Error(message.message);
}

class PackageWorker {
  private worker: Worker;
  private pending: { expect: PackageWorkerMessage['type']; resolve: (m: PackageWorkerMessage) => void; reject: (e: unknown) => void } | null = null;
  private started = false;
  onStage: ((stage: PackageStage) => void) | null = null;

  constructor() {
    this.worker = new Worker(new URL('../workers/packages.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<PackageWorkerMessage>) => {
      this.started = true;
      const data = event.data;
      if (data.type === 'stage') {
        this.onStage?.(data.stage);
        return;
      }
      const pending = this.pending;
      this.pending = null;
      if (!pending) return;
      if (data.type === 'error') pending.reject(errorFromWorker(data));
      else if (data.type === pending.expect) pending.resolve(data);
      else pending.reject(new Error(`Resposta inesperada do worker: ${data.type}`));
    };
    this.worker.onerror = (event) => {
      event.preventDefault?.();
      const pending = this.pending;
      this.pending = null;
      const text = event.message || 'Web Worker indisponível';
      pending?.reject(this.started ? new Error(text) : new WorkerStartError(text));
    };
  }

  request(message: PackageWorkerRequest, expect: PackageWorkerMessage['type'], transfer: Transferable[] = []): Promise<PackageWorkerMessage> {
    return new Promise((resolve, reject) => {
      this.pending = { expect, resolve, reject };
      this.worker.postMessage(message, transfer);
    });
  }

  terminate(): void {
    this.pending?.reject(new DOMException('Importação cancelada', 'AbortError'));
    this.pending = null;
    this.worker.terminate();
  }
}

/** Blob.arrayBuffer() falta em navegadores antigos (Safari < 14): FileReader como reserva. */
function readFile(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

async function prepareInWorker(file: Blob, onStage?: (stage: PackageStage) => void): Promise<PreparedImport> {
  const worker = new PackageWorker();
  worker.onStage = onStage ?? null;
  try {
    const bytes = await readFile(file);
    const parsed = (await worker.request({ type: 'parse', bytes }, 'parsed', [bytes])) as Extract<PackageWorkerMessage, { type: 'parsed' }>;
    let finished = false;
    return {
      manifest: parsed.manifest,
      records: parsed.records,
      bytes: parsed.bytes,
      expanded: parsed.expanded,
      previous: userModule(parsed.manifest.id),
      async install(stage) {
        if (finished) throw new Error('Importação já concluída.');
        checkDependencies(parsed.manifest);
        worker.onStage = stage ?? onStage ?? null;
        try {
          await worker.request({ type: 'install' }, 'installed');
        } finally {
          finished = true;
          worker.terminate();
        }
        await afterInstall();
      },
      discard() {
        finished = true;
        worker.terminate();
      },
    };
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

async function prepareInline(file: Blob, onStage?: (stage: PackageStage) => void): Promise<PreparedImport> {
  const pkg = await parsePackage(await readFile(file), onStage);
  onStage?.('prepare');
  let plan: InstallPlan | null = await buildInstallPlan(pkg);
  const manifest = plan.record.manifest;
  return {
    manifest,
    records: pkg.records.length,
    bytes: pkg.bytes,
    expanded: pkg.expanded,
    previous: userModule(manifest.id),
    async install(stage) {
      if (!plan) throw new Error('Importação já concluída.');
      checkDependencies(manifest);
      (stage ?? onStage)?.('write');
      const current = plan;
      plan = null;
      await writeInstallPlan(current);
      await afterInstall();
    },
    discard() {
      plan = null;
    },
  };
}

/**
 * ContentPackage.parse em segundo plano: lê, descompacta, confere SHA-256,
 * valida e prepara os registros. Nada é gravado até install().
 */
export async function preparePackageFile(
  file: Blob,
  onStage?: (stage: PackageStage) => void,
  options: { worker?: boolean } = {},
): Promise<PreparedImport> {
  if (file.size > MAX_PACKAGE_BYTES) throw new PackageError('too_large');
  onStage?.('read');
  // Com armazenamento só em memória (navegador bloqueou o IndexedDB), o worker
  // gravaria em outro banco: a importação segue na thread principal.
  const useWorker = options.worker ?? (typeof Worker !== 'undefined' && !isMemoryOnly());
  if (useWorker) {
    try {
      return await prepareInWorker(file, onStage);
    } catch (error) {
      if (!(error instanceof WorkerStartError)) throw error;
    }
  }
  return prepareInline(file, onStage);
}

// ------------------------------------------------------ ações de módulo
export class ModuleActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModuleActionError';
  }
}

const keepOneBible = () =>
  new ModuleActionError(tr('Mantenha ao menos uma Bíblia instalada.', 'Keep at least one Bible installed.', 'Mantenga al menos una Biblia instalada.'));

export const disabledModules = () => pref<string[]>('disabled_modules', []).filter((x) => typeof x === 'string');

/** Remover só é possível quando o módulo está instalado (e não é a última Bíblia). */
export function canRemove(id: string): boolean {
  const m = module(id);
  return !!m?.installed;
}

/** Restaurar: módulo embutido desativado que não depende de arquivo autorizado. */
export function canRestore(id: string): boolean {
  const m = module(id);
  if (!m || m.installed || userModule(id)) return false;
  const builtin = builtinModule(id);
  return !!builtin?.builtin && (builtin.metadata?.availability === undefined || builtin.metadata?.availability === null) && builtin.installed;
}

/** Primeira Bíblia instalada (exceto `except`), usada ao remover a tradução atual. */
export function firstInstalledBible(except?: string): string | null {
  return modules('bible', true).find((m) => m.id !== except)?.id ?? null;
}

/**
 * removeModule do original: desativa um módulo embutido (preferência
 * disabled_modules) ou importado (user_modules.enabled = false).
 */
export async function removeModule(id: string): Promise<void> {
  const m = module(id);
  if (!m || !m.installed) return;
  if (m.kind === 'bible' && modules('bible', true).length <= 1) throw keepOneBible();
  if (userModule(id)) await setUserModuleEnabled(id, false);
  else await setPref('disabled_modules', [...new Set([...disabledModules(), id])]);
}

/** restoreModule do original (apenas módulos embutidos). */
export async function restoreModule(id: string): Promise<void> {
  if (!builtinModule(id)?.builtin || userModule(id)) {
    throw new ModuleActionError(tr('Importe o pacote de conteúdo novamente.', 'Import the content package again.', 'Importe el paquete de contenido de nuevo.'));
  }
  await setPref(
    'disabled_modules',
    disabledModules().filter((x) => x !== id),
  );
}

export async function setUserModuleEnabled(id: string, enabled: boolean): Promise<void> {
  const record = await get<UserModule>('user_modules', id);
  if (!record) throw new ModuleActionError(tr('Módulo não encontrado.', 'Module not found.', 'Módulo no encontrado.'));
  if (!enabled && record.manifest.kind === 'bible' && record.enabled && modules('bible', true).length <= 1) throw keepOneBible();
  await put('user_modules', { ...record, enabled });
  await loadUserModules();
}

/** Bíblias instaladas que restariam depois de apagar o módulo importado `id`. */
function biblesAfterDelete(id: string): number {
  const builtin = builtinModule(id);
  const revealed = builtin && builtin.kind === 'bible' && builtin.installed && !disabledModules().includes(id) ? 1 : 0;
  return modules('bible', true).filter((m) => m.id !== id).length + revealed;
}

/** Apaga o registro e todos os dados do módulo importado (user_modules + user_module_data). */
export async function deleteUserModule(id: string): Promise<void> {
  const user = userModule(id);
  if (!user) return;
  if (user.manifest.kind === 'bible' && biblesAfterDelete(id) === 0) throw keepOneBible();
  await deleteModuleData(id);
  await loadUserModules();
}

// ---------------------------------------------------------- resumos
export interface ModuleSummary {
  books?: number;
  chapters?: number;
  verses?: number;
  entries?: number;
  translated?: number;
  lexemes?: number;
  records?: number;
}

/** Livros/versículos (Bíblia), verbetes (comentário/léxico) para a página do módulo. */
export function moduleSummary(id: string): ModuleSummary {
  const user = userModule(id) as (UserModule & { records?: number }) | undefined;
  const kind = module(id)?.kind ?? '';
  if (kind === 'bible') {
    const chapters = user ? user.books ?? {} : catalog.bibles[id]?.chapters ?? {};
    const lists = Object.values(chapters);
    const verses = user
      ? user.records ?? lists.reduce((sum, list) => sum + list.reduce((a, b) => a + b, 0), 0)
      : catalog.bibles[id]?.verses ?? Number(builtinModule(id)?.metadata?.verses ?? 0);
    return { books: lists.length, chapters: lists.reduce((sum, list) => sum + list.length, 0), verses };
  }
  if (kind === 'commentary') {
    if (user) return { entries: user.records, books: user.commentaryBooks?.length ?? 0 };
    const pack = catalog.commentaries[id];
    return pack ? { entries: pack.entries, books: pack.books.length, translated: pack.translated } : {};
  }
  if (kind === 'lexicon') {
    if (user) return { records: user.records };
    return { lexemes: catalog.lexicon.lexemes };
  }
  return user ? { records: user.records } : {};
}

/** Ordem natural dos identificadores (WCF.2 antes de WCF.10). */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
