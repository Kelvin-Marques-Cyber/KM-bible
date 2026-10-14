// Biblioteca (lib/library.dart): módulos instalados, importação de .biblepkg com
// aceite de licença, página do módulo (ModulePage) e conteúdo offline, inclusive
// o download completo para usar o aplicativo 100% sem internet.
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BookOpen,
  Box,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleMinus,
  Download,
  FileText,
  FileUp,
  HardDrive,
  HardDriveDownload,
  Languages,
  LibraryBig,
  MessageSquare,
  Network,
  PackagePlus,
  Power,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  Smartphone,
  Square,
  Trash2,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { app, closeSheet, navigate, refresh, set, useApp } from '../lib/app';
import type { ModuleInfo } from '../lib/catalog';
import { firstRefOfBook, hasVerse, installed, licenseText, loadUserModules, module, moduleDocuments, modules, userModule, type DocumentRow } from '../lib/content';
import { ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import {
  canRestore,
  deleteUserModule,
  firstInstalledBible,
  importErrorText,
  isPdfFile,
  kindLabel,
  LIBRARY_KINDS,
  matchesKind,
  moduleSummary,
  naturalCompare,
  pdfMessage,
  preparePackageFile,
  removeModule,
  restoreModule,
  setUserModuleEnabled,
  stageLabel,
  type PackageStage,
  type PreparedImport,
} from '../lib/packages';
import {
  cancelOfflineJob,
  downloadAll,
  downloadGroups,
  essentialGroups,
  fullOfflineFlag,
  fullSize,
  groupsSize,
  groupStatuses,
  hasCacheApi,
  isComplete,
  keepScreenAwake,
  loadFilesIndex,
  offlineGroups,
  offlineJob,
  OfflineQuotaError,
  removeGroup,
  runOfflineJob,
  subscribeOfflineJob,
  type DownloadProgress,
  type GroupKind,
  type GroupStatus,
  type OfflineGroup,
} from '../lib/offline';
import { formatBytes, isStandalone, platform, requestPersistence, storageInfo } from '../lib/pwa';
import { Button, Card, Chip, ErrorBox, Feature, ListItem, Progress, Small, Spinner, Wrap, cx, message, useAsync } from '../components/ui';
import { openDocument, openInstallHelp, openLinguistics, openModule, openOffline } from './open';

const locale = () => (lang() === 'en' ? 'en' : lang() === 'es' ? 'es' : 'pt-BR');
const num = (n: number) => n.toLocaleString(locale());
const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------ Biblioteca
const PAGE = 60;
const ARA_TITLE = 'Almeida Revista e Atualizada (ARA)';

export default function LibraryPage() {
  useApp();
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<PackageStage | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const pendingRef = useRef<PreparedImport | null>(null);
  const ara = installed('ARA');
  const rows = modules().filter((m) => matchesKind(m, kind));
  const ios = useMemo(() => platform() === 'ios', []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Diálogo aberto quando a tela some: descarta os dados preparados.
      pendingRef.current?.discard();
      pendingRef.current = null;
    };
  }, []);

  const pick = () => {
    if (busy) return;
    input.current?.click();
  };

  const focusImport = () => document.getElementById('km-import-module')?.focus();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    // Como no original: PDF não é importado diretamente.
    if (isPdfFile(file)) {
      setStatus(pdfMessage(installed('ARA')));
      return;
    }
    setBusy(true);
    setStatus(null);
    setStage('read');
    try {
      const ready = await preparePackageFile(file, (s) => alive.current && setStage(s));
      if (!alive.current) {
        ready.discard();
        return;
      }
      pendingRef.current = ready;
      setPrepared(ready);
    } catch (error) {
      if (!alive.current) return;
      setStatus(`${t('error')}: ${importErrorText(error)}`);
      setBusy(false);
      setStage(null);
    }
  };

  const accept = async () => {
    const ready = prepared;
    if (!ready) return;
    pendingRef.current = null;
    setPrepared(null);
    try {
      await ready.install((s) => alive.current && setStage(s));
      refresh();
      if (alive.current) setStatus(`${t('success')} · ${ready.manifest.title}`);
      else message(`${t('success')} · ${ready.manifest.title}`);
    } catch (error) {
      if (alive.current) setStatus(`${t('error')}: ${importErrorText(error)}`);
      else message(`${t('error')}: ${importErrorText(error)}`);
    } finally {
      if (alive.current) {
        setBusy(false);
        setStage(null);
        focusImport();
      }
    }
  };

  const cancel = () => {
    prepared?.discard();
    pendingRef.current = null;
    setPrepared(null);
    setBusy(false);
    setStage(null);
    focusImport();
  };

  const readAra = () => {
    set('edition_chosen', true);
    navigate(hasVerse('ARA', app.passage) ? app.passage : ref(1, 1, 1), { edition: 'ARA' });
  };

  const full = fullOfflineFlag();

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-3xl p-[18px]">
        <h2 className="sr-only">{t('library')}</h2>
        {/* A ARA é opcional: instalações pessoais podem incluí-la; nas distribuições
            públicas cada usuário importa o próprio módulo autorizado. */}
        <Card className="p-4">
          <h3 className="text-[16.5px] font-semibold">{ARA_TITLE}</h3>
          <p className="mt-1.5 text-[15px]">
            {ara
              ? tr(
                  'Edição instalada para leitura offline. Conteúdo da Sociedade Bíblica do Brasil, distribuído com autorização informada pelo responsável do projeto.',
                  'Edition installed for offline reading. Content from the Brazilian Bible Society, distributed with the authorization reported by the project owner.',
                  'Edición instalada para lectura sin conexión. Contenido de la Sociedad Bíblica de Brasil, distribuido con la autorización informada por el responsable del proyecto.',
                )
              : tr(
                  'Ainda não instalada. Se você possui uma cópia autorizada, importe seu módulo .biblepkg para ler offline.',
                  'Not installed yet. If you have an authorized copy, import its .biblepkg module to read offline.',
                  'Aún no instalada. Si tiene una copia autorizada, importe su módulo .biblepkg para leer sin conexión.',
                )}
          </p>
          <div className="mt-3">
            {ara ? (
              <Button icon={BookOpen} onClick={readAra}>
                {tr('Ler Bíblia ARA', 'Read ARA Bible', 'Leer Biblia ARA')}
              </Button>
            ) : (
              <Button variant="outlined" icon={FileUp} disabled={busy} onClick={pick}>
                {tr('Importar ARA', 'Import ARA', 'Importar ARA')}
              </Button>
            )}
          </div>
        </Card>

        <div className="mt-3">
          <Button id="km-import-module" icon={PackagePlus} disabled={busy} onClick={pick}>
            {tr('Importar módulo (.biblepkg)', 'Import module (.biblepkg)', 'Importar módulo (.biblepkg)')}
          </Button>
          {/* No iOS, extensões desconhecidas no accept deixam o arquivo acinzentado:
              lá o seletor fica livre e o próprio pacote é validado. */}
          <input
            ref={input}
            type="file"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            accept={ios ? undefined : '.biblepkg,application/zip'}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void onFile(file);
            }}
          />
          <Small className="mb-2.5 mt-2">
            {tr(
              'PDF não é importado diretamente nesta versão. Use um pacote .biblepkg de uma edição que tenha direito de usar.',
              'PDF is not imported directly in this version. Use a .biblepkg package of an edition you are entitled to use.',
              'El PDF no se importa directamente en esta versión. Use un paquete .biblepkg de una edición que tenga derecho a usar.',
            )}
          </Small>
        </div>

        <div role="status" aria-live="polite" className="empty:hidden">
          {busy && (
            <div className="my-2">
              <Progress />
              <p className="mt-1.5 text-[15px]">{t('importing')}</p>
              {stage && <Small>{stageLabel(stage)}</Small>}
            </div>
          )}
          {status && <p className="my-2 select-text whitespace-pre-line text-[15px] [overflow-wrap:anywhere]">{status}</p>}
        </div>

        <div className="mt-3">
          <Feature
            title={t('offlinePacks')}
            subtitle={
              full
                ? tr('Tudo baixado: o aplicativo funciona sem internet', 'Everything downloaded: the app works without internet', 'Todo descargado: la aplicación funciona sin internet')
                : tr('Baixe tudo para usar sem internet ou escolha o que guardar', 'Download everything to use offline or choose what to keep', 'Descargue todo para usar sin conexión o elija qué guardar')
            }
            icon={full ? CircleCheck : HardDriveDownload}
            onClick={() => openOffline()}
          />
        </div>

        <Wrap className="mt-2">
          <span className="sr-only" id="km-kind-filter">
            {tr('Filtrar por tipo de módulo', 'Filter by module type', 'Filtrar por tipo de módulo')}
          </span>
          <div role="group" aria-labelledby="km-kind-filter" className="flex flex-wrap gap-2">
            {LIBRARY_KINDS.map((k) => (
              <Chip
                key={k || 'all'}
                selected={kind === k}
                onClick={() => {
                  setKind(k);
                  setLimit(PAGE);
                }}
              >
                {k ? kindLabel(k) : t('all')}
              </Chip>
            ))}
          </div>
        </Wrap>

        <p className="sr-only" aria-live="polite">
          {plural(rows.length, tr('módulo', 'module', 'módulo'), tr('módulos', 'modules', 'módulos'))}
        </p>
        {rows.length === 0 && <Small className="mt-4">{tr('Nenhum módulo deste tipo.', 'No modules of this type.', 'Ningún módulo de este tipo.')}</Small>}
        <ul className="mt-3 space-y-2">
          {rows.slice(0, limit).map((m) => (
            <li key={m.id}>
              <ModuleCard module={m} />
            </li>
          ))}
        </ul>
        {rows.length > limit && (
          <Button variant="text" className="mt-2" onClick={() => setLimit((n) => n + PAGE)}>
            {t('more')} ({num(rows.length - limit)})
          </Button>
        )}
      </div>
      {prepared && <LicenseDialog prepared={prepared} onAccept={() => void accept()} onCancel={cancel} />}
    </div>
  );
}

function ModuleCard({ module: m }: { module: ModuleInfo }) {
  const Icon = m.installed ? CircleCheck : Download;
  return (
    <Card onClick={() => openModule(m)}>
      <span className="flex items-start gap-3 px-4 py-3">
        <Icon size={22} aria-hidden className={cx('mt-0.5 shrink-0', m.installed ? 'text-primary' : 'text-muted')} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-medium leading-snug [overflow-wrap:anywhere]">{m.title}</span>
          <span className="mt-0.5 block text-sm text-muted [overflow-wrap:anywhere]">{[m.language, m.author].filter(Boolean).join(' · ')}</span>
          {m.license && (
            <span className="block text-sm text-muted [overflow-wrap:anywhere]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {m.license}
            </span>
          )}
          <span className={cx('mt-0.5 block text-sm', m.installed ? 'text-primary' : 'text-muted')}>{t(m.installed ? 'installed' : 'pending')}</span>
        </span>
        <ChevronRight size={20} aria-hidden className="mt-1 shrink-0 text-muted" />
      </span>
    </Card>
  );
}

// ------------------------------------------------------------- diálogo de licença
function LicenseDialog({ prepared, onAccept, onCancel }: { prepared: PreparedImport; onAccept: () => void; onCancel: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const m = prepared.manifest as Record<string, unknown> & { title: string };
  const field = (key: string) => String(m[key] ?? '');

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('h2')?.focus();
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      // Não deixa o atalho global fechar a folha por baixo do diálogo.
      event.stopPropagation();
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab' || !box.current) return;
    const focusable = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !box.current.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-ui text-on-surface" onKeyDown={onKeyDown}>
      <button type="button" tabIndex={-1} aria-label={t('cancel')} className="absolute inset-0 bg-black/45" onClick={onCancel} />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="km-license-title"
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-[560px] flex-col rounded-3xl bg-surface shadow-2xl ring-1 ring-outline/30"
      >
        <h2 id="km-license-title" tabIndex={-1} className="px-6 pt-6 text-xl font-semibold leading-snug outline-none [overflow-wrap:anywhere]">
          {m.title}
        </h2>
        <div className="scroll-area min-h-0 flex-1 px-6 py-3" tabIndex={0} aria-label={tr('Termos de uso', 'Terms of use', 'Términos de uso')}>
          <p className="select-text whitespace-pre-line text-[15px] [overflow-wrap:anywhere]">
            {`${field('author')} · ${field('language')} · ${field('version')}\n${field('license')}\n${field('source')}`}
          </p>
          <Small className="mt-2">
            {`${kindLabel(field('kind'))} · ${plural(prepared.records, tr('registro', 'record', 'registro'), tr('registros', 'records', 'registros'))} · ${formatBytes(prepared.bytes)}`}
          </Small>
          {prepared.previous && (
            <p className="mt-2 rounded-xl bg-secondary-container px-3 py-2 text-sm">
              {tr(
                `Substituirá o módulo já importado com o mesmo identificador (versão ${String(prepared.previous.manifest.version ?? '')}).`,
                `It will replace the module already imported with the same identifier (version ${String(prepared.previous.manifest.version ?? '')}).`,
                `Reemplazará el módulo ya importado con el mismo identificador (versión ${String(prepared.previous.manifest.version ?? '')}).`,
              )}
            </p>
          )}
          <p className="mt-4 select-text whitespace-pre-wrap text-[15px] [overflow-wrap:anywhere]">{field('license_text')}</p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 py-1">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-primary" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span className="text-[15px]">{t('rights')}</span>
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-6 pb-5 pt-2">
          <Button variant="text" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button disabled={!accepted} onClick={onAccept}>
            {t('install')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------ página do módulo
const GUIDES = ['HDL-GUIA-FONTES', 'EXP2-HDL-CAT', 'JOSEMAR-GUIA-FONTES'];
const VIRTUAL_AFTER = 80;

/** Lista virtual que rola junto com o restante da página (o cabeçalho rola junto). */
function useAnchoredVirtual(count: number, enabled: boolean, estimate: number) {
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLUListElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const outer = scroller.current;
    const inner = anchor.current;
    if (!enabled || !outer || !inner) return;
    const measure = () => {
      const offset = inner.getBoundingClientRect().top - outer.getBoundingClientRect().top + outer.scrollTop;
      setMargin((previous) => (Math.abs(previous - offset) > 0.5 ? offset : previous));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    let node: Element | null = inner;
    while (node && node !== outer) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) if (sibling !== node) observer.observe(sibling);
      node = node.parentElement;
    }
    return () => observer.disconnect();
  }, [enabled]);
  const virtual = useVirtualizer({
    count: enabled ? count : 0,
    getScrollElement: () => scroller.current,
    estimateSize: () => estimate,
    overscan: 8,
    scrollMargin: margin,
    initialRect: { width: 360, height: 720 },
  });
  return { scroller, anchor, virtual, margin };
}

const docTitle = (d: DocumentRow) => (d.pt?.title && !['WCF', 'WSC', 'WLC'].includes(d.module_id) ? d.pt.title : d.title);

function metadataValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const text = JSON.stringify(value);
    return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
  } catch {
    return String(value);
  }
}

export function ModulePage({ moduleId }: { moduleId: string }) {
  useApp();
  const m = module(moduleId);
  const user = userModule(moduleId);
  const kind = m?.kind ?? '';
  const textual = !!m && !['bible', 'commentary', 'lexicon'].includes(kind);
  const docs = useAsync(
    async () => (m?.installed && textual ? [...(await moduleDocuments(moduleId))].sort((a, b) => naturalCompare(a.id, b.id)) : []),
    [moduleId, m?.installed, textual, user?.installedAt],
  );
  const list = docs.data ?? [];
  const virtualized = list.length > VIRTUAL_AFTER;
  const { scroller, anchor, virtual, margin } = useAnchoredVirtual(list.length, virtualized, 52);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!m) {
    return (
      <div className="mx-auto max-w-3xl p-5">
        <p>{tr('Módulo não encontrado.', 'Module not found.', 'Módulo no encontrado.')}</p>
      </div>
    );
  }

  const metadata = m.metadata ?? {};
  const availability = metadata.availability;
  const summary = moduleSummary(moduleId);
  const restorable = canRestore(moduleId);

  /** Depois de remover/apagar: troca a tradução atual se ela deixou de existir. */
  const settle = async (changed: string) => {
    await loadUserModules();
    if (app.translation === changed && !installed(changed)) {
      const next = firstInstalledBible(changed);
      if (next) {
        set('translation', next);
        const target = hasVerse(next, app.passage) ? app.passage : firstRefOfBook(next);
        if (navigate(target, { edition: next })) return;
        app.translation = next;
      }
    }
    refresh();
    closeSheet();
  };

  const act = async (fn: () => Promise<void>, after: () => Promise<void> | void) => {
    setWorking(true);
    setError(null);
    try {
      await fn();
      await after();
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(text);
      message(text);
    } finally {
      setWorking(false);
    }
  };

  const read = () => {
    if (moduleId === 'ARA') set('edition_chosen', true);
    navigate(hasVerse(moduleId, app.passage) ? app.passage : firstRefOfBook(moduleId), { edition: moduleId });
  };

  const heading = textual
    ? `${tr('Conteúdo disponível', 'Available content', 'Contenido disponible')} · ${docs.data ? plural(list.length, tr('texto', 'text', 'texto'), tr('textos', 'texts', 'textos')) : '…'}`
    : tr('Conteúdo disponível', 'Available content', 'Contenido disponible');

  return (
    <div ref={scroller} className="scroll-area h-full">
      <div className="mx-auto max-w-3xl p-5 sm:p-[22px]">
        <h3 className="text-xl font-semibold leading-snug [overflow-wrap:anywhere]">{m.title}</h3>
        <p className="mt-1.5 text-sm text-muted [overflow-wrap:anywhere]">{[m.author, m.language].filter(Boolean).join(' · ')}</p>
        {user && (
          <Small className="mt-1">
            {tr('Importado em', 'Imported on', 'Importado el')} {new Date(user.installedAt).toLocaleDateString(locale())} · {formatBytes(user.bytes)}
            {!user.enabled && ` · ${tr('desativado', 'disabled', 'desactivado')}`}
          </Small>
        )}
        {typeof availability === 'string' && availability && !m.installed && (
          <p className="mt-3 rounded-xl bg-secondary-container px-3 py-2 text-[15px]">{availability}</p>
        )}
        {GUIDES.includes(m.id) && (
          <p className="mt-3.5 text-[15px]">
            {tr(
              'Este é um guia de fontes e leitura, não uma edição integral dos comentários do autor.',
              "This is a guide to sources and reading, not a complete edition of the author's commentaries.",
              'Esta es una guía de fuentes y lectura, no una edición íntegra de los comentarios del autor.',
            )}
          </p>
        )}

        <h4 className="mt-4 text-[17px] font-medium">{heading}</h4>
        <ModuleContent kind={kind} installed={m.installed} summary={summary} isUser={!!user} onRead={read} />

        {textual && (
          <div className="mt-2">
            {docs.error ? (
              <ErrorBox error={docs.error} onRetry={docs.reload} />
            ) : docs.data === undefined ? (
              <Spinner />
            ) : list.length === 0 ? (
              <Small>{tr('Este módulo não contém textos disponíveis para leitura.', 'This module has no texts available for reading.', 'Este módulo no contiene textos disponibles para leer.')}</Small>
            ) : virtualized ? (
              <ul ref={anchor} className="relative" style={{ height: virtual.getTotalSize() }} aria-label={heading}>
                {virtual.getVirtualItems().map((item) => {
                  const d = list[item.index];
                  return (
                    <li
                      key={d.id}
                      data-index={item.index}
                      ref={virtual.measureElement}
                      className="absolute inset-x-0 top-0"
                      style={{ transform: `translateY(${item.start - margin}px)` }}
                    >
                      <ListItem title={docTitle(d)} trailing="chevron" onClick={() => openDocument(d)} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul aria-label={heading}>
                {list.map((d) => (
                  <li key={d.id}>
                    <ListItem title={docTitle(d)} trailing="chevron" onClick={() => openDocument(d)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <hr className="my-6 border-outline/50" />
        <details
          className="group rounded-2xl ring-1 ring-outline/40"
          onToggle={(e) => setLicenseOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 text-[15.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
            <ScrollText size={20} aria-hidden className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">{tr('Licença, fonte e informações técnicas', 'License, source and technical information', 'Licencia, fuente e información técnica')}</span>
            <ChevronDown size={20} aria-hidden className="shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="select-text px-4 pb-4 text-[15px] [overflow-wrap:anywhere]">
            <p className="whitespace-pre-line">{`${m.language} · ${tr('versão', 'version', 'versión')} ${m.version}\n${m.license}\n${m.source}`}</p>
            {licenseOpen && <LicenseBody id={moduleId} />}
            {Object.keys(metadata).length > 0 && (
              <p className="mt-3 whitespace-pre-line text-sm text-muted">
                {Object.entries(metadata)
                  .map(([key, value]) => `${key}: ${metadataValue(value)}`)
                  .join('\n')}
              </p>
            )}
          </div>
        </details>

        <div className="mt-4 space-y-2">
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <Wrap>
            {m.installed ? (
              <Button variant="outlined" icon={CircleMinus} disabled={working} onClick={() => void act(() => removeModule(moduleId), () => settle(moduleId))}>
                {t('remove')}
              </Button>
            ) : user ? (
              <Button
                icon={Power}
                disabled={working}
                onClick={() =>
                  void act(
                    () => setUserModuleEnabled(moduleId, true),
                    () => {
                      refresh();
                      closeSheet();
                    },
                  )
                }
              >
                {tr('Ativar módulo', 'Enable module', 'Activar módulo')}
              </Button>
            ) : restorable ? (
              <Button
                icon={RotateCcw}
                disabled={working}
                onClick={() =>
                  void act(
                    () => restoreModule(moduleId),
                    async () => {
                      await loadUserModules();
                      refresh();
                      closeSheet();
                    },
                  )
                }
              >
                {t('restore')}
              </Button>
            ) : null}
            {user && !confirmDelete && (
              <Button variant="text" icon={Trash2} disabled={working} className="text-danger" onClick={() => setConfirmDelete(true)}>
                {tr('Apagar dados do módulo', 'Delete module data', 'Borrar datos del módulo')}
              </Button>
            )}
          </Wrap>
          {user && confirmDelete && (
            <div role="alertdialog" aria-labelledby="km-delete-title" className="rounded-2xl bg-danger/10 p-4">
              <p id="km-delete-title" className="text-[15px]">
                {tr(
                  `Apagar definitivamente “${m.title}” deste aparelho? Para usar de novo, será preciso importar o pacote outra vez.`,
                  `Permanently delete “${m.title}” from this device? To use it again you will need to import the package again.`,
                  `¿Borrar definitivamente «${m.title}» de este dispositivo? Para usarlo de nuevo tendrá que importar el paquete otra vez.`,
                )}
              </p>
              <Wrap className="mt-3 justify-end">
                <Button variant="text" disabled={working} onClick={() => setConfirmDelete(false)} autoFocus>
                  {t('cancel')}
                </Button>
                <Button
                  icon={Trash2}
                  disabled={working}
                  className="!bg-danger/15 !text-danger"
                  onClick={() => void act(() => deleteUserModule(moduleId), () => settle(moduleId))}
                >
                  {tr('Apagar', 'Delete', 'Borrar')}
                </Button>
              </Wrap>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleContent({
  kind,
  installed: isInstalled,
  summary,
  isUser,
  onRead,
}: {
  kind: string;
  installed: boolean;
  summary: ReturnType<typeof moduleSummary>;
  isUser: boolean;
  onRead: () => void;
}) {
  if (kind === 'bible') {
    return (
      <div className="mt-1.5">
        {(summary.books ?? 0) > 0 ? (
          <p className="text-[15px]">
            {[
              plural(summary.books ?? 0, tr('livro', 'book', 'libro'), tr('livros', 'books', 'libros')),
              plural(summary.chapters ?? 0, tr('capítulo', 'chapter', 'capítulo'), tr('capítulos', 'chapters', 'capítulos')),
              plural(summary.verses ?? 0, tr('versículo', 'verse', 'versículo'), tr('versículos', 'verses', 'versículos')),
            ].join(' · ')}
          </p>
        ) : (
          <Small>{t('pending')}</Small>
        )}
        {isInstalled && (summary.books ?? 0) > 0 && (
          <Button className="mt-3" icon={BookOpen} onClick={onRead}>
            {tr('Ler', 'Read', 'Leer')}
          </Button>
        )}
      </div>
    );
  }
  if (kind === 'commentary') {
    const parts: string[] = [];
    if (summary.entries !== undefined) parts.push(plural(summary.entries, tr('comentário', 'commentary entry', 'comentario'), tr('comentários', 'commentary entries', 'comentarios')));
    if (summary.books) parts.push(plural(summary.books, tr('livro bíblico', 'Bible book', 'libro bíblico'), tr('livros bíblicos', 'Bible books', 'libros bíblicos')));
    return (
      <div className="mt-1.5">
        {parts.length ? <p className="text-[15px]">{parts.join(' · ')}</p> : <Small>{t('pending')}</Small>}
        {!!summary.translated && (
          <Small className="mt-1">
            {plural(summary.translated, tr('verbete com tradução para o português', 'entry translated into Portuguese', 'entrada con traducción al portugués'), tr('verbetes com tradução para o português', 'entries translated into Portuguese', 'entradas con traducción al portugués'))}
          </Small>
        )}
        {isInstalled && (
          <Small className="mt-1">
            {tr(
              'Os comentários aparecem junto ao texto bíblico, em Comentários, no versículo escolhido.',
              'Commentaries appear next to the Bible text, under Commentaries, for the chosen verse.',
              'Los comentarios aparecen junto al texto bíblico, en Comentarios, para el versículo elegido.',
            )}
          </Small>
        )}
      </div>
    );
  }
  if (kind === 'lexicon') {
    return (
      <div className="mt-1.5">
        {isUser ? (
          <>
            {summary.records !== undefined && <p className="text-[15px]">{plural(summary.records, tr('verbete', 'entry', 'entrada'), tr('verbetes', 'entries', 'entradas'))}</p>}
            <p className="mt-2 rounded-xl bg-secondary-container px-3 py-2 text-sm">
              {tr(
                'Suporte limitado: os verbetes deste léxico importado ficam guardados no aparelho, mas ainda não aparecem no dicionário do original nem na pesquisa linguística desta versão.',
                'Limited support: the entries of this imported lexicon are stored on the device, but they do not yet appear in the original-language dictionary or linguistic search in this version.',
                'Soporte limitado: las entradas de este léxico importado se guardan en el dispositivo, pero aún no aparecen en el diccionario del original ni en la búsqueda lingüística de esta versión.',
              )}
            </p>
          </>
        ) : (
          <>
            {!!summary.lexemes && <p className="text-[15px]">{plural(summary.lexemes, tr('verbete', 'entry', 'entrada'), tr('verbetes', 'entries', 'entradas'))}</p>}
            {isInstalled && (
              <Button variant="tonal" className="mt-3" icon={Languages} onClick={() => openLinguistics()}>
                {t('linguistics')}
              </Button>
            )}
          </>
        )}
      </div>
    );
  }
  return null;
}

function LicenseBody({ id }: { id: string }) {
  const state = useAsync(() => licenseText(id), [id]);
  if (state.loading && state.data === undefined) return <Small className="mt-3">{t('loading')}</Small>;
  if (!state.data) return null;
  return <p className="mt-3 whitespace-pre-wrap">{state.data}</p>;
}

// ------------------------------------------------------------- conteúdo offline
const groupIcon: Record<GroupKind, typeof BookOpen> = {
  bible: BookOpen,
  commentary: MessageSquare,
  xref: Network,
  original: Languages,
  topics: LibraryBig,
  documents: FileText,
  search: Search,
  models: Box,
};

function useOfflineJob() {
  return useSyncExternalStore(subscribeOfflineJob, offlineJob);
}

function progressText(p: DownloadProgress | null): string {
  if (!p) return tr('Preparando…', 'Preparing…', 'Preparando…');
  return tr(
    `${num(p.done)} de ${num(p.total)} arquivos · ${formatBytes(p.bytesDone)} de ${formatBytes(p.bytesTotal)}`,
    `${num(p.done)} of ${num(p.total)} files · ${formatBytes(p.bytesDone)} of ${formatBytes(p.bytesTotal)}`,
    `${num(p.done)} de ${num(p.total)} archivos · ${formatBytes(p.bytesDone)} de ${formatBytes(p.bytesTotal)}`,
  );
}

const ratio = (p: DownloadProgress | null) => (p && p.total > 0 ? Math.min(1, p.done / p.total) : 0);

function JobProgress({ progress, onCancel, label }: { progress: DownloadProgress | null; onCancel: () => void; label: string }) {
  return (
    <div className="mt-3">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio(progress) * 100)}
        aria-valuetext={progressText(progress)}
      >
        <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(ratio(progress) * 100)}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm tabular-nums">{progressText(progress)}</span>
        <Button variant="text" icon={Square} onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}

function failureText(failed: number): string {
  return tr(
    `${plural(failed, 'arquivo não pôde ser baixado', 'arquivos não puderam ser baixados')}. Verifique a conexão e toque de novo para tentar outra vez; o que já foi baixado é mantido.`,
    `${plural(failed, 'file could not be downloaded', 'files could not be downloaded')}. Check the connection and tap again to retry; what was already downloaded is kept.`,
    `${plural(failed, 'archivo no se pudo descargar', 'archivos no se pudieron descargar')}. Revise la conexión y toque de nuevo; lo ya descargado se conserva.`,
  );
}

export function OfflinePage({ autoStart }: { autoStart?: 'all' }) {
  useApp();
  const job = useOfflineJob();
  const running = job?.state === 'running';
  const supported = hasCacheApi();
  const groups = useMemo(() => offlineGroups(), [app.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const index = useAsync(() => (supported ? loadFilesIndex() : Promise.resolve(null)), [supported]);
  const [statuses, setStatuses] = useState<Record<string, GroupStatus> | null>(null);
  const [statusTick, setStatusTick] = useState(0);
  const [storageTick, setStorageTick] = useState(0);
  const storage = useAsync(() => storageInfo(), [storageTick]);
  const [removing, setRemoving] = useState<string | null>(null);
  const ios = useMemo(() => platform() === 'ios', []);
  const standalone = useMemo(() => isStandalone(), []);
  const started = useRef(false);

  // Status dos grupos: uma leitura de cache.keys(); refeita ao terminar cada tarefa.
  useEffect(() => {
    if (!index.data || running) return;
    let alive = true;
    groupStatuses(groups, index.data).then(
      (s) => alive && setStatuses(s),
      () => alive && setStatuses({}),
    );
    return () => {
      alive = false;
    };
  }, [index.data, groups, running, statusTick]);

  useEffect(() => {
    if (!running) setStorageTick((n) => n + 1);
  }, [running]);

  // Tela acesa durante o download; liberada ao terminar, cancelar ou sair.
  useEffect(() => {
    if (!running) return;
    return keepScreenAwake();
  }, [running]);

  const totalBytes = fullSize(groups);
  const presentBytes = statuses ? groups.reduce((sum, g) => sum + (statuses[g.id]?.bytesPresent ?? 0), 0) : 0;
  const allComplete = !!statuses && groups.every((g) => isComplete(statuses[g.id]));
  const anyPresent = !!statuses && groups.some((g) => (statuses[g.id]?.present ?? 0) > 0);
  const essential = essentialGroups(app.translation, groups);
  const essentialComplete = !!statuses && essential.every((g) => isComplete(statuses[g.id]));
  const room = storage.data && storage.data.quota !== null ? Math.max(0, storage.data.quota - (storage.data.usage ?? 0)) : null;
  const missingAll = Math.max(0, totalBytes - presentBytes);
  const tight = room !== null && missingAll > room * 0.95;

  const startAll = () => {
    if (running || !supported) return;
    void runOfflineJob('all', tr('Baixar tudo', 'Download everything', 'Descargar todo'), (onProgress, signal) => downloadAll(onProgress, signal));
  };
  const startGroups = (id: string, label: string, list: OfflineGroup[]) => {
    if (running || !supported) return;
    void runOfflineJob(id, label, (onProgress, signal) => downloadGroups(list, { onProgress, signal }));
  };

  useEffect(() => {
    if (autoStart === 'all' && !started.current && supported) {
      started.current = true;
      startAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, supported]);

  const remove = async (g: OfflineGroup) => {
    setRemoving(g.id);
    try {
      await removeGroup(g);
      message(tr(`${g.title}: removido do aparelho`, `${g.title}: removed from this device`, `${g.title}: quitado del dispositivo`));
    } catch (error) {
      message(error instanceof Error ? error.message : String(error));
    } finally {
      setRemoving(null);
      setStatusTick((n) => n + 1);
      setStorageTick((n) => n + 1);
    }
  };

  const jobFor = (id: string) => (job && job.id === id ? job : null);
  const allJob = jobFor('all');
  const essentialJob = jobFor('essential');

  return (
    <div className="mx-auto max-w-3xl p-5">
      {ios && !standalone && (
        <div className="mb-4 rounded-2xl bg-secondary-container p-4" role="note">
          <p className="flex items-center gap-2 font-semibold">
            <Smartphone size={20} aria-hidden />
            {tr('No iPhone e no iPad, instale o app primeiro', 'On iPhone and iPad, install the app first', 'En iPhone y iPad, instale primero la aplicación')}
          </p>
          <p className="mt-1.5 text-[15px]">
            {tr(
              'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. O Safari pode apagar os dados de sites que não estão na Tela de Início depois de alguns dias sem uso; por isso, faça o download completo pelo aplicativo instalado (ícone na Tela de Início). Você ainda pode baixar por aqui.',
              'In Safari, tap Share and then “Add to Home Screen”. Safari may erase data of sites that are not on the Home Screen after some days without use, so do the full download from the installed app (Home Screen icon). You can still download here.',
              'En Safari, toque en Compartir y luego en “Añadir a la pantalla de inicio”. Safari puede borrar los datos de sitios que no están en la pantalla de inicio tras algunos días sin uso; por eso, haga la descarga completa desde la aplicación instalada. Aún puede descargar aquí.',
            )}
          </p>
          <Button variant="text" className="mt-1 px-2" icon={Smartphone} onClick={() => openInstallHelp()}>
            {t('installApp')}
          </Button>
        </div>
      )}

      <section aria-labelledby="km-offline-all" className="rounded-3xl bg-primary-container p-5 text-on-primary-container">
        <h3 id="km-offline-all" className="flex items-center gap-2 text-xl font-semibold">
          <WifiOff size={22} aria-hidden />
          {tr('Usar 100% sem internet', 'Use 100% offline', 'Usar 100% sin internet')}
        </h3>
        <p className="mt-2 text-[15px]">
          {tr(
            `Baixa todas as traduções, comentários, referências cruzadas, idioma original, temas, documentos, estudos, contexto, índices de pesquisa e modelos 3D: cerca de ${formatBytes(totalBytes)}.`,
            `Downloads every translation, commentary, cross reference, original language data, topics, documents, studies, context, search indexes and 3D models: about ${formatBytes(totalBytes)}.`,
            `Descarga todas las traducciones, comentarios, referencias cruzadas, idioma original, temas, documentos, estudios, contexto, índices de búsqueda y modelos 3D: unos ${formatBytes(totalBytes)}.`,
          )}
        </p>
        <div aria-live="polite" className="mt-2 text-[15px]">
          {!supported ? (
            <p className="flex items-start gap-2">
              <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
              {tr(
                'Este navegador não permite guardar conteúdo para uso offline. Use um navegador atualizado ou instale o aplicativo.',
                'This browser cannot store content for offline use. Use an up-to-date browser or install the app.',
                'Este navegador no permite guardar contenido sin conexión. Use un navegador actualizado o instale la aplicación.',
              )}
            </p>
          ) : allJob?.state === 'running' ? null : allComplete ? (
            <p className="flex items-center gap-2 font-semibold">
              <CircleCheck size={20} aria-hidden />
              {tr('Tudo pronto: o aplicativo funciona sem internet', 'All set: the app works without internet', 'Todo listo: la aplicación funciona sin internet')}
            </p>
          ) : statuses && anyPresent ? (
            <p>
              {tr(
                `${formatBytes(presentBytes)} de ${formatBytes(totalBytes)} já estão no aparelho. O download continua de onde parou.`,
                `${formatBytes(presentBytes)} of ${formatBytes(totalBytes)} already on this device. The download resumes where it stopped.`,
                `${formatBytes(presentBytes)} de ${formatBytes(totalBytes)} ya están en el dispositivo. La descarga continúa donde se detuvo.`,
              )}
              {fullOfflineFlag() &&
                ` ${tr('Há conteúdo novo no acervo: baixe de novo para continuar 100% offline.', 'There is new content: download again to stay 100% offline.', 'Hay contenido nuevo: descargue de nuevo para seguir 100% sin conexión.')}`}
            </p>
          ) : null}
          {allJob?.state === 'cancelled' && (
            <p className="mt-1">
              {tr('Download interrompido. Toque em “Baixar tudo” para continuar de onde parou.', 'Download stopped. Tap “Download everything” to resume.', 'Descarga interrumpida. Toque en “Descargar todo” para continuar.')}
            </p>
          )}
          {allJob?.state === 'done' && (allJob.result?.failed ?? 0) > 0 && <p className="mt-1">{failureText(allJob.result!.failed)}</p>}
          {allJob?.state === 'error' && (
            <p role="alert" className="mt-1">
              {allJob.error instanceof Error ? allJob.error.message : String(allJob.error)}
            </p>
          )}
          {tight && !allComplete && !running && (
            <p className="mt-1 flex items-start gap-2">
              <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
              {new OfflineQuotaError(missingAll, room).message}
            </p>
          )}
        </div>
        {allJob?.state === 'running' ? (
          <JobProgress progress={allJob.progress} onCancel={cancelOfflineJob} label={tr('Baixando tudo', 'Downloading everything', 'Descargando todo')} />
        ) : (
          supported &&
          !allComplete && (
            <Button className="mt-4 min-h-[52px] w-full text-[16.5px] sm:w-auto" icon={HardDriveDownload} disabled={running || !index.data} onClick={startAll}>
              {tr('Baixar tudo para usar sem internet', 'Download everything to use offline', 'Descargar todo para usar sin internet')}
            </Button>
          )
        )}
      </section>

      <p className="mt-5 text-[15px]">
        {tr(
          'Tudo o que você abre uma vez fica guardado automaticamente no aparelho e continua disponível sem conexão. Para garantir o acesso desde já, baixe tudo acima ou escolha os grupos abaixo.',
          'Everything you open once is kept automatically on this device and stays available offline. To guarantee access in advance, download everything above or choose groups below.',
          'Todo lo que abre una vez se guarda automáticamente en el dispositivo y sigue disponible sin conexión. Para garantizar el acceso, descargue todo arriba o elija grupos abajo.',
        )}
      </p>

      {index.error ? (
        <ErrorBox error={index.error} onRetry={index.reload} />
      ) : !supported ? null : !index.data ? (
        <Spinner />
      ) : (
        <>
          <div className="mt-4 rounded-2xl ring-1 ring-outline/40 p-4">
            <p className="font-medium">{tr('Baixar o essencial', 'Download the essentials', 'Descargar lo esencial')}</p>
            <Small className="mt-0.5">
              {tr(
                `Tradução atual (${app.translation}), referências cruzadas, temas, documentos e pesquisa · ${formatBytes(groupsSize(essential))}`,
                `Current translation (${app.translation}), cross references, topics, documents and search · ${formatBytes(groupsSize(essential))}`,
                `Traducción actual (${app.translation}), referencias cruzadas, temas, documentos y búsqueda · ${formatBytes(groupsSize(essential))}`,
              )}
            </Small>
            {essentialJob?.state === 'running' ? (
              <JobProgress progress={essentialJob.progress} onCancel={cancelOfflineJob} label={tr('Baixando o essencial', 'Downloading the essentials', 'Descargando lo esencial')} />
            ) : essentialComplete ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-primary">
                <CircleCheck size={18} aria-hidden />
                {tr('Essencial disponível sem internet', 'Essentials available offline', 'Lo esencial está disponible sin conexión')}
              </p>
            ) : (
              <Button
                variant="tonal"
                className="mt-3"
                icon={Download}
                disabled={running}
                onClick={() => startGroups('essential', tr('Baixar o essencial', 'Download the essentials', 'Descargar lo esencial'), essential)}
              >
                {tr('Baixar o essencial', 'Download the essentials', 'Descargar lo esencial')}
              </Button>
            )}
            {essentialJob?.state === 'error' && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {essentialJob.error instanceof Error ? essentialJob.error.message : String(essentialJob.error)}
              </p>
            )}
            {essentialJob?.state === 'done' && (essentialJob.result?.failed ?? 0) > 0 && <Small className="mt-2">{failureText(essentialJob.result!.failed)}</Small>}
          </div>

          <h3 className="mt-6 text-[17px] font-semibold">{tr('Grupos de conteúdo', 'Content groups', 'Grupos de contenido')}</h3>
          <ul className="mt-2 space-y-2">
            {groups.map((g) => (
              <li key={g.id}>
                <GroupRow
                  group={g}
                  status={statuses?.[g.id]}
                  job={jobFor(g.id)}
                  busy={running || removing !== null}
                  removing={removing === g.id}
                  onDownload={() => startGroups(g.id, g.title, [g])}
                  onRemove={() => void remove(g)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <section aria-labelledby="km-storage" className="mt-6 rounded-2xl ring-1 ring-outline/40 p-4">
        <h3 id="km-storage" className="flex items-center gap-2 text-[17px] font-semibold">
          <HardDrive size={20} aria-hidden className="text-primary" />
          {t('storage')}
        </h3>
        {storage.data ? (
          <>
            <p className="mt-1.5 text-[15px]">
              {storage.data.usage !== null
                ? tr(
                    `Em uso: ${formatBytes(storage.data.usage)}${storage.data.quota !== null ? ` de ${formatBytes(storage.data.quota)} disponíveis para o aplicativo` : ''}`,
                    `In use: ${formatBytes(storage.data.usage)}${storage.data.quota !== null ? ` of ${formatBytes(storage.data.quota)} available to the app` : ''}`,
                    `En uso: ${formatBytes(storage.data.usage)}${storage.data.quota !== null ? ` de ${formatBytes(storage.data.quota)} disponibles para la aplicación` : ''}`,
                  )
                : tr('O navegador não informa o espaço usado.', 'The browser does not report storage usage.', 'El navegador no informa el espacio usado.')}
            </p>
            <p className="mt-1 flex items-start gap-2 text-[15px]">
              <ShieldCheck size={18} aria-hidden className={cx('mt-0.5 shrink-0', storage.data.persisted ? 'text-primary' : 'text-muted')} />
              {storage.data.persisted === true
                ? tr(
                    'Armazenamento persistente ativado: o navegador não apaga estes dados para liberar espaço.',
                    'Persistent storage enabled: the browser will not erase this data to free space.',
                    'Almacenamiento persistente activado: el navegador no borra estos datos para liberar espacio.',
                  )
                : storage.data.persisted === false
                  ? tr(
                      'Armazenamento persistente não concedido: com pouco espaço, o navegador pode apagar o conteúdo offline (suas anotações ficam no backup).',
                      'Persistent storage not granted: when space runs low, the browser may erase offline content (keep a backup of your notes).',
                      'Almacenamiento persistente no concedido: con poco espacio, el navegador puede borrar el contenido sin conexión.',
                    )
                  : tr('O navegador não informa se o armazenamento é persistente.', 'The browser does not report whether storage is persistent.', 'El navegador no informa si el almacenamiento es persistente.')}
            </p>
            {storage.data.persisted === false && (
              <Button
                variant="text"
                className="mt-1 px-2"
                icon={ShieldCheck}
                onClick={async () => {
                  const granted = await requestPersistence();
                  message(
                    granted
                      ? tr('Armazenamento persistente ativado.', 'Persistent storage enabled.', 'Almacenamiento persistente activado.')
                      : tr(
                          'O navegador não concedeu agora. Instalar o app e usá-lo com frequência costuma liberar essa permissão.',
                          'The browser did not grant it now. Installing the app and using it often usually enables it.',
                          'El navegador no lo concedió ahora. Instalar la aplicación y usarla con frecuencia suele habilitarlo.',
                        ),
                  );
                  setStorageTick((n) => n + 1);
                }}
              >
                {tr('Pedir armazenamento persistente', 'Request persistent storage', 'Solicitar almacenamiento persistente')}
              </Button>
            )}
          </>
        ) : (
          <Small className="mt-1.5">{t('loading')}</Small>
        )}
      </section>
    </div>
  );
}

function GroupRow({
  group: g,
  status,
  job,
  busy,
  removing,
  onDownload,
  onRemove,
}: {
  group: OfflineGroup;
  status: GroupStatus | undefined;
  job: ReturnType<typeof offlineJob>;
  busy: boolean;
  removing: boolean;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const Icon = groupIcon[g.kind];
  const complete = isComplete(status);
  const state: ReactNode = !status
    ? tr('Verificando…', 'Checking…', 'Comprobando…')
    : complete
      ? tr('Baixado', 'Downloaded', 'Descargado')
      : status.present > 0
        ? tr(`${num(status.present)} de ${num(status.total)} arquivos`, `${num(status.present)} of ${num(status.total)} files`, `${num(status.present)} de ${num(status.total)} archivos`)
        : tr('Não baixado', 'Not downloaded', 'No descargado');
  return (
    <div className="rounded-2xl bg-surface-low p-3 ring-1 ring-outline/30">
      <div className="flex items-start gap-3">
        <Icon size={22} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] font-medium leading-snug [overflow-wrap:anywhere]">{g.title}</p>
          <p className="text-sm text-muted [overflow-wrap:anywhere]">{g.description}</p>
          <p className={cx('mt-0.5 flex items-center gap-1.5 text-sm', complete && 'text-primary')}>
            {complete && <CircleCheck size={15} aria-hidden />}
            <span>
              {formatBytes(g.bytes)} · {state}
            </span>
          </p>
        </div>
      </div>
      {job?.state === 'running' ? (
        <JobProgress progress={job.progress} onCancel={cancelOfflineJob} label={g.title} />
      ) : (
        <>
          {job?.state === 'error' && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {job.error instanceof Error ? job.error.message : String(job.error)}
            </p>
          )}
          {job?.state === 'done' && (job.result?.failed ?? 0) > 0 && <Small className="mt-2">{failureText(job.result!.failed)}</Small>}
          <Wrap className="mt-2 justify-end">
            {!complete && (
              <Button variant="tonal" icon={Download} disabled={busy || !status} onClick={onDownload} aria-label={`${t('download')}: ${g.title}`}>
                {t('download')}
              </Button>
            )}
            {(status?.present ?? 0) > 0 && (
              <Button variant="text" icon={Trash2} disabled={busy} onClick={onRemove} aria-label={`${t('remove_offline')}: ${g.title}`}>
                {removing ? tr('Removendo…', 'Removing…', 'Quitando…') : tr('Remover', 'Remove', 'Quitar')}
              </Button>
            )}
          </Wrap>
        </>
      )}
    </div>
  );
}
